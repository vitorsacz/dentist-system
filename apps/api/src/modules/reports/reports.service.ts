import { Injectable } from "@nestjs/common";
import type { FinancialReport, FinancialReportQuery } from "@dentist-system/shared-types";
import { PrismaService } from "../../prisma/prisma.service";

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async financialReport(query: FinancialReportQuery): Promise<FinancialReport> {
    const attendances = await this.prisma.attendance.findMany({
      where: {
        date: { gte: query.from, lte: query.to },
        ...(query.clinicId ? { clinicId: query.clinicId } : {}),
      },
      include: { clinic: true },
    });

    type Acc = {
      clinicId: string;
      clinicName: string;
      grossRevenue: number;
      dentistRepasse: number;
      materialCost: number;
      rentDays: Set<string>;
      dailyRentValue: number;
      isRented: boolean;
    };

    const byClinic = new Map<string, Acc>();

    for (const attendance of attendances) {
      const clinicId = attendance.clinicId;
      const gross = Number(attendance.grossValue);
      const repasse = gross * (Number(attendance.repassePercentage) / 100);
      const materialCost = Number(attendance.materialCost);

      let acc = byClinic.get(clinicId);
      if (!acc) {
        acc = {
          clinicId,
          clinicName: attendance.clinic.name,
          grossRevenue: 0,
          dentistRepasse: 0,
          materialCost: 0,
          rentDays: new Set<string>(),
          dailyRentValue: attendance.clinic.dailyRentValue ? Number(attendance.clinic.dailyRentValue) : 0,
          isRented: attendance.clinic.type === "RENTED",
        };
        byClinic.set(clinicId, acc);
      }

      acc.grossRevenue += gross;
      acc.dentistRepasse += repasse;
      acc.materialCost += materialCost;
      if (acc.isRented) {
        acc.rentDays.add(dayKey(attendance.date));
      }
    }

    const clinics = Array.from(byClinic.values()).map((acc) => {
      const rentCost = acc.isRented ? acc.rentDays.size * acc.dailyRentValue : 0;
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
    };
  }
}
