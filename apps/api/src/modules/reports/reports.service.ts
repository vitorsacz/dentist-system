import { Inject, Injectable } from "@nestjs/common";
import type { FinancialReport, FinancialReportQuery } from "@dentist-system/shared-types";
import type { AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { PRISMA_SERVICE, type PrismaService } from "../../prisma/prisma.service";
import { getTenantContext } from "../../prisma/tenant-context";

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

@Injectable()
export class ReportsService {
  constructor(@Inject(PRISMA_SERVICE) private readonly prisma: PrismaService) {}

  async financialReport(query: FinancialReportQuery, actor: AuthenticatedUser): Promise<FinancialReport> {
    const { organizationId } = getTenantContext();
    const dentistOnly = actor.roles.includes("DENTIST") && !actor.roles.includes("ADMIN");

    const [org, attendances] = await Promise.all([
      this.prisma.organization.findUniqueOrThrow({ where: { id: organizationId } }),
      this.prisma.attendance.findMany({
        where: {
          date: { gte: query.from, lte: query.to },
          ...(query.clinicId ? { clinicId: query.clinicId } : {}),
          ...(dentistOnly ? { dentistUserId: actor.id } : {}),
        },
        include: { clinic: { include: { financialTerms: true } } },
      }),
    ]);

    const isFreelancer = org.type === "FREELANCER";

    type Acc = {
      clinicId: string;
      clinicName: string;
      grossRevenue: number;
      dentistRepasse: number;
      materialCost: number;
      rentDays: Set<string>;
      // Apenas FREELANCER + RENTED_FIXED + DAILY
      dailyRentValue: number;
      hasTerms: boolean;
    };

    const byClinic = new Map<string, Acc>();

    for (const attendance of attendances) {
      const clinicId = attendance.clinicId;
      const gross = Number(attendance.grossValue);
      const repasse = gross * (Number(attendance.repassePercentage) / 100);
      const materialCost = Number(attendance.materialCost);

      let acc = byClinic.get(clinicId);
      if (!acc) {
        const terms = attendance.clinic.financialTerms;
        const isDailyRent =
          isFreelancer &&
          terms?.relationshipType === "RENTED_FIXED" &&
          terms?.rentPeriodicity === "DAILY";
        acc = {
          clinicId,
          clinicName: attendance.clinic.name,
          grossRevenue: 0,
          dentistRepasse: 0,
          materialCost: 0,
          rentDays: new Set<string>(),
          dailyRentValue: isDailyRent && terms?.rentValue ? Number(terms.rentValue) : 0,
          hasTerms: !isFreelancer || terms != null,
        };
        byClinic.set(clinicId, acc);
      }

      acc.grossRevenue += gross;
      acc.dentistRepasse += repasse;
      acc.materialCost += materialCost;
      if (acc.dailyRentValue > 0) {
        acc.rentDays.add(dayKey(attendance.date));
      }
    }

    const clinicsWithoutTerms: string[] = [];
    const clinics = Array.from(byClinic.values()).map((acc) => {
      if (!acc.hasTerms) {
        clinicsWithoutTerms.push(acc.clinicName);
      }
      const rentCost = acc.rentDays.size * acc.dailyRentValue;
      const netResult = acc.dentistRepasse - acc.materialCost - rentCost;
      return {
        clinicId: acc.clinicId,
        clinicName: acc.clinicName,
        grossRevenue: acc.grossRevenue,
        dentistRepasse: acc.dentistRepasse,
        materialCost: acc.materialCost,
        rentCost,
        netResult,
      };
    });

    const totals = clinics.reduce(
      (acc, row) => ({
        grossRevenue: acc.grossRevenue + row.grossRevenue,
        dentistRepasse: acc.dentistRepasse + row.dentistRepasse,
        materialCost: acc.materialCost + row.materialCost,
        rentCost: acc.rentCost + row.rentCost,
        netResult: acc.netResult + row.netResult,
      }),
      { grossRevenue: 0, dentistRepasse: 0, materialCost: 0, rentCost: 0, netResult: 0 },
    );

    return {
      from: query.from.toISOString(),
      to: query.to.toISOString(),
      clinics,
      totals,
      clinicsWithoutTerms,
    };
  }
}
