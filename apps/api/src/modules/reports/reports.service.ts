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
    // DENTIST sem ADMIN: escopo próprio. ADMIN: todos os dentistas.
    const dentistOnly = actor.roles.includes("DENTIST") && !actor.roles.includes("ADMIN");

    const [org, attendances] = await Promise.all([
      this.prisma.organization.findUniqueOrThrow({ where: { id: organizationId } }),
      this.prisma.attendance.findMany({
        where: {
          date: { gte: query.from, lte: query.to },
          ...(query.clinicId ? { clinicId: query.clinicId } : {}),
          ...(dentistOnly ? { dentistUserId: actor.id } : {}),
        },
        include: {
          clinic: { include: { financialTerms: true } },
          dentistUser: { select: { id: true, name: true } },
        },
      }),
    ]);

    const isFreelancer = org.type === "FREELANCER";

    type Acc = {
      clinicId: string;
      clinicName: string;
      dentistUserId?: string;
      dentistName?: string;
      grossRevenue: number;
      dentistRepasse: number;
      materialCost: number;
      rentDays: Set<string>;
      // Apenas FREELANCER + RENTED_FIXED + DAILY
      dailyRentValue: number;
      hasTerms: boolean;
    };

    // DENTIST: key = clinicId. ADMIN: key = dentistId:clinicId.
    const byKey = new Map<string, Acc>();
    // Admin view: (clinicId:dayKey) → dailyRentValue; avoids double-counting when multiple
    // dentists share the same clinic-day (rent belongs to the clinic, not to each dentist).
    const globalClinicRentDays = new Map<string, number>();

    for (const attendance of attendances) {
      const clinicId = attendance.clinicId;
      const dUserId = attendance.dentistUserId ?? undefined;
      const key = dentistOnly ? clinicId : `${dUserId ?? ""}:${clinicId}`;
      const gross = Number(attendance.grossValue);
      const repasse = gross * (Number(attendance.repassePercentage) / 100);
      const materialCost = attendance.materialByDentist ? 0 : Number(attendance.materialCost);

      let acc = byKey.get(key);
      if (!acc) {
        const terms = attendance.clinic.financialTerms;
        const isDailyRent =
          isFreelancer &&
          terms?.relationshipType === "RENTED_FIXED" &&
          terms?.rentPeriodicity === "DAILY";
        acc = {
          clinicId,
          clinicName: attendance.clinic.name,
          ...(dentistOnly
            ? {}
            : { dentistUserId: dUserId, dentistName: attendance.dentistUser?.name ?? undefined }),
          grossRevenue: 0,
          dentistRepasse: 0,
          materialCost: 0,
          rentDays: new Set<string>(),
          dailyRentValue: isDailyRent && terms?.rentValue ? Number(terms.rentValue) : 0,
          hasTerms: !isFreelancer || terms != null,
        };
        byKey.set(key, acc);
      }

      acc.grossRevenue += gross;
      acc.dentistRepasse += repasse;
      acc.materialCost += materialCost;

      if (acc.dailyRentValue > 0) {
        const dk = dayKey(attendance.date);
        if (dentistOnly) {
          acc.rentDays.add(dk);
        } else {
          const rk = `${clinicId}:${dk}`;
          if (!globalClinicRentDays.has(rk)) {
            globalClinicRentDays.set(rk, acc.dailyRentValue);
          }
        }
      }
    }

    const clinicsWithoutTerms: string[] = [];
    const clinics = Array.from(byKey.values()).map((acc) => {
      if (!acc.hasTerms) {
        clinicsWithoutTerms.push(acc.clinicName);
      }
      // In dentistOnly view rent is per-row; in admin view it is a clinic-level cost (see totals).
      const rentCost = dentistOnly ? acc.rentDays.size * acc.dailyRentValue : 0;
      const netResult = acc.dentistRepasse - acc.materialCost - rentCost;
      return {
        clinicId: acc.clinicId,
        clinicName: acc.clinicName,
        ...(acc.dentistUserId !== undefined
          ? { dentistUserId: acc.dentistUserId, dentistName: acc.dentistName }
          : {}),
        grossRevenue: acc.grossRevenue,
        dentistRepasse: acc.dentistRepasse,
        materialCost: acc.materialCost,
        rentCost,
        netResult,
      };
    });

    const rentCostTotal = dentistOnly
      ? clinics.reduce((s, r) => s + r.rentCost, 0)
      : Array.from(globalClinicRentDays.values()).reduce((s, v) => s + v, 0);

    const totals = clinics.reduce(
      (acc, row) => ({
        grossRevenue: acc.grossRevenue + row.grossRevenue,
        dentistRepasse: acc.dentistRepasse + row.dentistRepasse,
        materialCost: acc.materialCost + row.materialCost,
        rentCost: 0,
        netResult: acc.netResult + row.netResult,
      }),
      { grossRevenue: 0, dentistRepasse: 0, materialCost: 0, rentCost: 0, netResult: 0 },
    );
    totals.rentCost = rentCostTotal;
    totals.netResult = totals.dentistRepasse - totals.materialCost - rentCostTotal;

    // Monthly breakdown — groups attendances by month with deduplicated daily rent per clinic-day.
    type MonthAcc = { grossRevenue: number; dentistRepasse: number; materialCost: number };
    const byMonth = new Map<string, MonthAcc>();
    const monthlyClinicRentDays = new Map<string, Map<string, number>>();

    for (const attendance of attendances) {
      const month = attendance.date.toISOString().slice(0, 7);
      const gross = Number(attendance.grossValue);
      const repasse = gross * (Number(attendance.repassePercentage) / 100);
      const materialCost = attendance.materialByDentist ? 0 : Number(attendance.materialCost);

      let mAcc = byMonth.get(month);
      if (!mAcc) {
        mAcc = { grossRevenue: 0, dentistRepasse: 0, materialCost: 0 };
        byMonth.set(month, mAcc);
      }
      mAcc.grossRevenue += gross;
      mAcc.dentistRepasse += repasse;
      mAcc.materialCost += materialCost;

      const terms = attendance.clinic.financialTerms;
      const isDailyRent =
        isFreelancer &&
        terms?.relationshipType === "RENTED_FIXED" &&
        terms?.rentPeriodicity === "DAILY";
      if (isDailyRent && terms?.rentValue) {
        const rk = `${attendance.clinicId}:${dayKey(attendance.date)}`;
        let monthRent = monthlyClinicRentDays.get(month);
        if (!monthRent) {
          monthRent = new Map();
          monthlyClinicRentDays.set(month, monthRent);
        }
        if (!monthRent.has(rk)) {
          monthRent.set(rk, Number(terms.rentValue));
        }
      }
    }

    const monthly = Array.from(byMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, acc]) => {
        const rentCost = Array.from(monthlyClinicRentDays.get(month)?.values() ?? []).reduce(
          (s, v) => s + v,
          0,
        );
        return {
          month,
          grossRevenue: acc.grossRevenue,
          dentistRepasse: acc.dentistRepasse,
          materialCost: acc.materialCost,
          rentCost,
          netResult: acc.dentistRepasse - acc.materialCost - rentCost,
        };
      });

    return {
      from: query.from.toISOString(),
      to: query.to.toISOString(),
      clinics,
      totals,
      monthly,
      clinicsWithoutTerms,
    };
  }

  async financialReportCsv(query: FinancialReportQuery, actor: AuthenticatedUser): Promise<string> {
    const report = await this.financialReport(query, actor);
    const hasAdminView = report.clinics.some((r) => r.dentistUserId !== undefined);

    const q = (s: string) => {
      const escaped = s.replace(/"/g, '""');
      // CSV formula injection prevention (OWASP): prefix trigger chars with tab so
      // spreadsheets don't evaluate the cell as a formula.
      const safe = /^[=+\-@\t\r]/.test(escaped) ? `\t${escaped}` : escaped;
      return `"${safe}"`;
    };
    const n = (v: number) => v.toFixed(2).replace(".", ",");

    const colHeaders = [
      ...(hasAdminView ? ["Dentista", "Consultório"] : ["Consultório"]),
      "Faturamento Bruto",
      "Repasse Dentista",
      "Custo Material",
      "Custo Aluguel",
      "Resultado Líquido",
    ];

    const dataRows = report.clinics.map((r) =>
      [
        ...(hasAdminView ? [q(r.dentistName ?? ""), q(r.clinicName)] : [q(r.clinicName)]),
        n(r.grossRevenue),
        n(r.dentistRepasse),
        n(r.materialCost),
        n(r.rentCost),
        n(r.netResult),
      ].join(";"),
    );

    const totalRow = [
      ...(hasAdminView ? [q("Total"), ""] : [q("Total")]),
      n(report.totals.grossRevenue),
      n(report.totals.dentistRepasse),
      n(report.totals.materialCost),
      n(report.totals.rentCost),
      n(report.totals.netResult),
    ].join(";");

    // BOM prefix for Excel UTF-8 compatibility
    return "﻿" + [colHeaders.join(";"), ...dataRows, totalRow].join("\r\n");
  }
}
