import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { PRISMA_SERVICE, PRISMA_UNSCOPED_SERVICE, type PrismaBaseService, type PrismaService } from "../../prisma/prisma.service";
import { getTenantContext } from "../../prisma/tenant-context";

function isDentistOnly(actor: AuthenticatedUser): boolean {
  return actor.roles.includes("DENTIST") && !actor.roles.includes("ADMIN") && !actor.roles.includes("RECEPTIONIST");
}

function canSeeRevenue(actor: AuthenticatedUser): boolean {
  return actor.roles.includes("DENTIST") || actor.roles.includes("ADMIN");
}

function startOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function endOfDay(d: Date): Date {
  const s = startOfDay(d);
  return new Date(s.getTime() + 86400000 - 1);
}

function startOfWeek(d: Date): Date {
  const dow = d.getUTCDay(); // 0=Sun
  const diff = (dow + 6) % 7; // Mon-based
  const mon = new Date(d.getTime() - diff * 86400000);
  return startOfDay(mon);
}

function endOfWeek(d: Date): Date {
  const mon = startOfWeek(d);
  return new Date(mon.getTime() + 7 * 86400000 - 1);
}

function startOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function endOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) - 1);
}

@Injectable()
export class DashboardService {
  constructor(
    @Inject(PRISMA_SERVICE) private readonly prisma: PrismaService,
    @Inject(PRISMA_UNSCOPED_SERVICE) private readonly rawPrisma: PrismaBaseService,
  ) {}

  async overview(actor: AuthenticatedUser) {
    const { organizationId } = getTenantContext();
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    const weekStart = startOfWeek(now);
    const weekEnd = endOfWeek(now);
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    const dentistOnly = isDentistOnly(actor);
    const dentistFilter = dentistOnly ? { dentistUserId: actor.id } : {};

    // Today's appointments (list)
    const todayAppts = await this.prisma.appointment.findMany({
      where: {
        startsAt: { gte: todayStart, lte: todayEnd },
        ...dentistFilter,
      },
      include: {
        patient: { select: { name: true } },
        clinic: { select: { name: true } },
      },
      orderBy: { startsAt: "asc" },
    });

    // Week appointment count
    const appointmentsThisWeek = await this.prisma.appointment.count({
      where: {
        startsAt: { gte: weekStart, lte: weekEnd },
        ...dentistFilter,
      },
    });

    // Active patients count (org-wide always — patients don't have dentist scope here)
    const activePatients = await this.prisma.patient.count({
      where: { active: true },
    });

    // Attendances this month
    const attendancesThisMonth = await this.prisma.attendance.count({
      where: {
        date: { gte: monthStart, lte: monthEnd },
        ...dentistFilter,
      },
    });

    // ADMIN-only: incompleteProfile, teamMembers, stockAlerts
    let incompleteProfile: boolean | undefined;
    let teamMembers: { name: string; roles: string[]; active: boolean }[] | undefined;
    let stockAlerts: { id: string; name: string; unit: string; currentStock: number; minimumStock: number; nearExpiry: boolean }[] | undefined;

    if (actor.roles.includes("ADMIN")) {
      const activeClinicsCount = await this.prisma.clinic.count({ where: { active: true } });
      incompleteProfile = activeClinicsCount === 0;

      const users = await this.prisma.user.findMany({
        select: { name: true, roles: true, active: true },
        orderBy: { name: "asc" },
        take: 10,
      });
      teamMembers = users.map((u) => ({ name: u.name, roles: u.roles as string[], active: u.active }));

      const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 3600000);
      const materials = await this.prisma.material.findMany({
        include: { batches: { select: { quantity: true, expiryDate: true } } },
      });
      stockAlerts = materials
        .map((m) => {
          const currentStock = m.batches.reduce((sum, b) => sum + Number(b.quantity), 0);
          const nearExpiry = m.batches.some(
            (b) => b.expiryDate !== null && b.expiryDate <= thirtyDaysFromNow && Number(b.quantity) > 0,
          );
          return { id: m.id, name: m.name, unit: m.unit, currentStock, minimumStock: Number(m.minimumStock), nearExpiry };
        })
        .filter((m) => m.currentStock < m.minimumStock || m.nearExpiry);
    }

    // Revenue (only for roles that can see it)
    let revenueThisMonth: number | undefined;
    let revenueByClinic: { clinicId: string; clinicName: string; revenue: number }[] | undefined;

    if (canSeeRevenue(actor)) {
      const attendances = await this.prisma.attendance.findMany({
        where: {
          date: { gte: monthStart, lte: monthEnd },
          ...dentistFilter,
        },
        select: { grossValue: true, clinicId: true, clinic: { select: { name: true } } },
      });

      revenueThisMonth = attendances.reduce((sum, a) => sum + Number(a.grossValue), 0);

      // Revenue by clinic only for FREELANCER org
      const org = await this.rawPrisma.organization.findUnique({ where: { id: organizationId }, select: { type: true } });
      if (org?.type === "FREELANCER") {
        const byClinic = new Map<string, { clinicId: string; clinicName: string; revenue: number }>();
        for (const a of attendances) {
          const existing = byClinic.get(a.clinicId);
          if (existing) {
            existing.revenue += Number(a.grossValue);
          } else {
            byClinic.set(a.clinicId, { clinicId: a.clinicId, clinicName: a.clinic.name, revenue: Number(a.grossValue) });
          }
        }
        revenueByClinic = Array.from(byClinic.values()).sort((a, b) => b.revenue - a.revenue);
      }
    }

    return {
      appointmentsToday: todayAppts.map((a) => ({
        id: a.id,
        time: a.startsAt.toISOString().slice(11, 16),
        patientName: a.patient.name,
        clinicName: a.clinic.name,
        status: a.status,
      })),
      appointmentsThisWeek,
      activePatients,
      attendancesThisMonth,
      revenueThisMonth,
      revenueByClinic,
      incompleteProfile,
      teamMembers,
      stockAlerts,
    };
  }
}
