import { ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type { AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { PRISMA_SERVICE, type PrismaService } from "../../prisma/prisma.service";

export type AccessKind = "registry" | "clinicalRead" | "clinicalWrite";

export interface PatientAccess {
  isOwner: boolean;
  canWriteClinical: boolean;
  canShare: boolean;
  eligibleDentists?: { id: string; name: string }[];
}

@Injectable()
export class PatientAccessService {
  constructor(@Inject(PRISMA_SERVICE) private readonly prisma: PrismaService) {}

  patientWhere(actor: AuthenticatedUser, kind: AccessKind): Prisma.PatientWhereInput {
    const hasDentist = actor.roles.includes("DENTIST");
    const hasAdmin = actor.roles.includes("ADMIN");
    const hasReceptionist = actor.roles.includes("RECEPTIONIST");

    if (kind === "registry" && (hasAdmin || hasReceptionist)) return {};
    if (kind === "clinicalRead" && hasAdmin) return {};

    if (hasDentist) {
      return {
        OR: [
          { ownerDentistId: actor.id },
          { shares: { some: { dentistId: actor.id, revokedAt: null } } },
        ],
      };
    }

    return { id: "__no_access__" };
  }

  async assertPatientAccess(
    patientId: string,
    actor: AuthenticatedUser,
    kind: AccessKind,
  ): Promise<{ id: string; ownerDentistId: string | null; organizationId: string; [key: string]: unknown }> {
    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
      include: { ownerDentist: { select: { id: true, name: true } } },
    });
    if (!patient) throw new NotFoundException("Paciente não encontrado");

    const hasDentist = actor.roles.includes("DENTIST");
    const hasAdmin = actor.roles.includes("ADMIN");
    const hasReceptionist = actor.roles.includes("RECEPTIONIST");

    if (kind === "registry" && (hasAdmin || hasReceptionist)) return patient;
    if (kind === "clinicalRead" && hasAdmin) return patient;

    const isOwner = patient.ownerDentistId === actor.id;
    const activeShare =
      hasDentist && !isOwner
        ? await this.prisma.patientShare.findUnique({
            where: { patientId_dentistId: { patientId, dentistId: actor.id } },
            select: { revokedAt: true, organizationId: true },
          })
        : null;
    const inScope = isOwner || (activeShare !== null && activeShare?.revokedAt === null);

    if (kind === "clinicalWrite") {
      // canRead: ADMIN reads all; DENTIST → scope
      const canRead = hasAdmin || (hasDentist && inScope);
      if (!canRead) throw new NotFoundException("Paciente não encontrado");
      // canWrite: needs DENTIST + scope
      if (!hasDentist || !inScope) {
        throw new ForbiddenException("Sem permissão para escrever dado clínico deste paciente");
      }
      return patient;
    }

    // registry (DENTIST path) or clinicalRead (DENTIST path)
    if (hasDentist && inScope) return patient;
    throw new NotFoundException("Paciente não encontrado");
  }

  async accessFor(patientId: string, actor: AuthenticatedUser): Promise<PatientAccess> {
    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
      select: { ownerDentistId: true, organizationId: true },
    });
    if (!patient) throw new NotFoundException("Paciente não encontrado");

    const hasDentist = actor.roles.includes("DENTIST");
    const hasAdmin = actor.roles.includes("ADMIN");

    const isOwner = patient.ownerDentistId === actor.id;
    const activeShare =
      hasDentist && !isOwner
        ? await this.prisma.patientShare.findUnique({
            where: { patientId_dentistId: { patientId, dentistId: actor.id } },
            select: { revokedAt: true, organizationId: true },
          })
        : null;
    const inDentistScope = isOwner || (activeShare !== null && activeShare?.revokedAt === null);

    const canWriteClinical = hasDentist && inDentistScope;
    const canShare = isOwner || hasAdmin;

    let eligibleDentists: { id: string; name: string }[] | undefined;
    if (canShare) {
      const activeShares = await this.prisma.patientShare.findMany({
        where: { patientId, revokedAt: null },
        select: { dentistId: true },
      });
      const excludeIds = new Set(activeShares.map((s) => s.dentistId));
      if (patient.ownerDentistId) excludeIds.add(patient.ownerDentistId);

      eligibleDentists = await this.prisma.user.findMany({
        where: {
          organizationId: patient.organizationId,
          active: true,
          roles: { has: "DENTIST" },
          id: { notIn: Array.from(excludeIds) },
        },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      });
    }

    return { isOwner, canWriteClinical, canShare, eligibleDentists };
  }

  async activeShares(patientId: string) {
    return this.prisma.patientShare.findMany({
      where: { patientId, revokedAt: null },
      select: {
        dentistId: true,
        dentist: { select: { id: true, name: true } },
        sharedAt: true,
      },
    });
  }
}
