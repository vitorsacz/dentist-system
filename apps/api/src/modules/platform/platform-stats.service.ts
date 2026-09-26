import { Inject, Injectable } from "@nestjs/common";
import { ROLES, type PlatformOverviewStats } from "@dentist-system/shared-types";
import { PRISMA_UNSCOPED_SERVICE, type PrismaBaseService } from "../../prisma/prisma.service";

function monthKey(date: Date) {
  return date.toISOString().slice(0, 7);
}

function lastNMonthKeys(n: number, from: Date) {
  const keys: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    keys.push(monthKey(new Date(from.getFullYear(), from.getMonth() - i, 1)));
  }
  return keys;
}

@Injectable()
export class PlatformStatsService {
  // Único consumidor legítimo de PRISMA_UNSCOPED_SERVICE — ver comentário em
  // prisma.service.ts. Toda query aqui é intencionalmente cross-tenant.
  constructor(@Inject(PRISMA_UNSCOPED_SERVICE) private readonly prisma: PrismaBaseService) {}

  async overview(): Promise<PlatformOverviewStats> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const [
      organizationsByStatusRaw,
      activeUsersByRole,
      activeUsersWithAnyRole,
      totalDentistsRegistered,
      totalDentistsActive,
      recentOrganizations,
      attendancesByOrg,
    ] = await Promise.all([
      this.prisma.organization.groupBy({ by: ["status"], _count: true }),
      // Um usuário com mais de um papel (ex.: ADMIN + DENTIST) conta em CADA
      // papel que tem — por isso a soma por papel pode passar do total.
      Promise.all(ROLES.map((role) => this.prisma.user.count({ where: { active: true, roles: { has: role } } }))),
      // Total = pessoas (usuários ativos com pelo menos um papel), não soma
      // dos papéis. Super Admin (sem papel) fica de fora, como antes.
      this.prisma.user.count({ where: { active: true, roles: { isEmpty: false } } }),
      this.prisma.user.count({ where: { roles: { has: "DENTIST" } } }),
      this.prisma.user.count({ where: { roles: { has: "DENTIST" }, active: true } }),
      this.prisma.organization.findMany({
        where: { createdAt: { gte: sixMonthsAgo } },
        select: { createdAt: true },
      }),
      this.prisma.attendance.groupBy({
        by: ["organizationId"],
        where: { date: { gte: startOfMonth, lt: startOfNextMonth } },
        _count: true,
      }),
    ]);

    const organizationsByStatus = { ACTIVE: 0, SUSPENDED: 0, DELETED: 0, total: 0 };
    for (const row of organizationsByStatusRaw) {
      organizationsByStatus[row.status] = row._count;
      organizationsByStatus.total += row._count;
    }

    const usersByRole = { ADMIN: 0, DENTIST: 0, RECEPTIONIST: 0, total: activeUsersWithAnyRole };
    ROLES.forEach((role, index) => {
      usersByRole[role] = activeUsersByRole[index] ?? 0;
    });

    const monthBuckets = new Map(lastNMonthKeys(6, now).map((key) => [key, 0]));
    for (const org of recentOrganizations) {
      const key = monthKey(org.createdAt);
      if (monthBuckets.has(key)) {
        monthBuckets.set(key, (monthBuckets.get(key) ?? 0) + 1);
      }
    }
    const newTenantsByMonth = Array.from(monthBuckets.entries()).map(([month, count]) => ({ month, count }));

    const attendancesThisMonth = attendancesByOrg.reduce((sum, row) => sum + row._count, 0);

    const topRows = [...attendancesByOrg].sort((a, b) => b._count - a._count).slice(0, 10);
    const orgIds = topRows.map((row) => row.organizationId);
    const organizations = orgIds.length
      ? await this.prisma.organization.findMany({
          where: { id: { in: orgIds } },
          select: { id: true, name: true, status: true },
        })
      : [];
    const organizationById = new Map(organizations.map((org) => [org.id, org]));
    const topOrganizationsByAttendance = topRows.flatMap((row) => {
      const org = organizationById.get(row.organizationId);
      if (!org) return [];
      return [{ organizationId: org.id, name: org.name, status: org.status, attendanceCount: row._count }];
    });

    return {
      organizationsByStatus,
      usersByRole,
      totalDentistsRegistered,
      totalDentistsActive,
      newTenantsByMonth,
      attendancesThisMonth,
      topOrganizationsByAttendance,
    };
  }
}
