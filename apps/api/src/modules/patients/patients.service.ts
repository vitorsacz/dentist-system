import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { CreatePatientInput, SharePatientInput, UpdatePatientInput } from "@dentist-system/shared-types";
import type { AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { PRISMA_SERVICE, type PrismaService } from "../../prisma/prisma.service";
import { getTenantContext } from "../../prisma/tenant-context";
import { PatientAccessService } from "./patient-access.service";

const ownerDentistInclude = { ownerDentist: { select: { id: true, name: true } } } as const;

@Injectable()
export class PatientsService {
  constructor(
    @Inject(PRISMA_SERVICE) private readonly prisma: PrismaService,
    private readonly patientAccess: PatientAccessService,
  ) {}

  list(actor: AuthenticatedUser, ownerDentistId?: string) {
    const where: Prisma.PatientWhereInput = {
      ...this.patientAccess.patientWhere(actor, "registry"),
      ...(ownerDentistId && actor.roles.includes("ADMIN") ? { ownerDentistId } : {}),
    };
    return this.prisma.patient.findMany({ where, orderBy: { name: "asc" }, include: ownerDentistInclude });
  }

  async findOne(id: string, actor?: AuthenticatedUser) {
    if (actor) {
      return this.patientAccess.assertPatientAccess(id, actor, "registry") as Promise<
        Awaited<ReturnType<PrismaService["patient"]["findUnique"]>>
      >;
    }
    const patient = await this.prisma.patient.findUnique({
      where: { id },
      include: ownerDentistInclude,
    });
    if (!patient) throw new NotFoundException("Paciente não encontrado");
    return patient;
  }

  async findOneWithAccess(id: string, actor: AuthenticatedUser) {
    await this.patientAccess.assertPatientAccess(id, actor, "registry");
    const patient = await this.prisma.patient.findUnique({
      where: { id },
      include: ownerDentistInclude,
    });
    if (!patient) throw new NotFoundException("Paciente não encontrado");
    const access = await this.patientAccess.accessFor(id, actor);
    return { ...patient, access };
  }

  async findRevisions(patientId: string, actor: AuthenticatedUser) {
    await this.patientAccess.assertPatientAccess(patientId, actor, "registry");
    return this.prisma.patientRevision.findMany({
      where: { patientId },
      orderBy: { changedAt: "desc" },
      include: { changedBy: { select: { id: true, name: true } } },
    });
  }

  async listUnassigned() {
    const { organizationId } = getTenantContext();
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId }, select: { type: true } });
    if (org?.type === "FREELANCER") throw new ForbiddenException("Não disponível para consultórios freelancer");
    return this.prisma.patient.findMany({
      where: { ownerDentistId: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, phone: true },
    });
  }

  async create(input: CreatePatientInput, actor: AuthenticatedUser) {
    const { organizationId } = getTenantContext();

    const ownerDentistId = await this.resolveOwnerDentistId(
      input.ownerDentistId,
      organizationId,
      actor,
      "create",
    );

    try {
      return await this.prisma.patient.create({
        data: { ...input, ownerDentistId, createdByUserId: actor.id, organizationId },
        include: ownerDentistInclude,
      });
    } catch (error) {
      this.mapCpfConflict(error);
      throw error;
    }
  }

  async update(id: string, input: UpdatePatientInput, actor: AuthenticatedUser) {
    const existing = await this.patientAccess.assertPatientAccess(id, actor, "registry");
    const { organizationId } = getTenantContext();

    if ("ownerDentistId" in input) {
      const isDentistOnly =
        actor.roles.includes("DENTIST") &&
        !actor.roles.includes("ADMIN") &&
        !actor.roles.includes("RECEPTIONIST");
      if (isDentistOnly) {
        throw new ForbiddenException("Dentista não pode alterar o responsável do paciente");
      }
    }

    let ownerDentistId: string | null | undefined = undefined;
    if ("ownerDentistId" in input) {
      if (input.ownerDentistId == null) {
        ownerDentistId = null;
      } else {
        ownerDentistId = await this.resolveOwnerDentistId(
          input.ownerDentistId,
          organizationId,
          actor,
          "update",
        );
      }
    }

    const updateData = { ...input, ...(ownerDentistId !== undefined ? { ownerDentistId } : {}) };

    try {
      return await this.prisma.$transaction(async (tx) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { ownerDentist: _od, ...patientSnapshot } = existing as typeof existing & { ownerDentist?: unknown };
        await tx.patientRevision.create({
          data: {
            patientId: id,
            snapshot: patientSnapshot as unknown as Prisma.InputJsonValue,
            changedById: actor.id,
            organizationId,
          },
        });

        return tx.patient.update({
          where: { id },
          data: updateData,
          include: ownerDentistInclude,
        });
      });
    } catch (error) {
      this.mapCpfConflict(error);
      throw error;
    }
  }

  async share(patientId: string, input: SharePatientInput, actor: AuthenticatedUser) {
    const patient = await this.patientAccess.assertPatientAccess(patientId, actor, "registry");
    const { organizationId } = getTenantContext();

    const canShare =
      patient.ownerDentistId === actor.id || actor.roles.includes("ADMIN");
    if (!canShare) {
      throw new ForbiddenException("Apenas o dentista responsável ou um admin pode compartilhar");
    }

    await this.validateOwnerDentist(input.dentistId, organizationId);

    return this.prisma.patientShare.upsert({
      where: { patientId_dentistId: { patientId, dentistId: input.dentistId } },
      create: { patientId, dentistId: input.dentistId, sharedById: actor.id, organizationId },
      update: { revokedAt: null, sharedAt: new Date(), sharedById: actor.id },
      select: { id: true, dentistId: true, sharedAt: true, dentist: { select: { id: true, name: true } } },
    });
  }

  async revoke(patientId: string, dentistId: string, actor: AuthenticatedUser) {
    const patient = await this.patientAccess.assertPatientAccess(patientId, actor, "registry");
    const canShare =
      patient.ownerDentistId === actor.id || actor.roles.includes("ADMIN");
    if (!canShare) {
      throw new ForbiddenException("Apenas o dentista responsável ou um admin pode revogar");
    }

    const share = await this.prisma.patientShare.findUnique({
      where: { patientId_dentistId: { patientId, dentistId } },
    });
    if (!share || share.revokedAt !== null) {
      throw new NotFoundException("Compartilhamento não encontrado");
    }

    return this.prisma.patientShare.update({
      where: { patientId_dentistId: { patientId, dentistId } },
      data: { revokedAt: new Date(), revokedById: actor.id },
      select: { id: true, dentistId: true, revokedAt: true },
    });
  }

  async bulkReassign(fromDentistId: string, toDentistId: string | null, actor: AuthenticatedUser) {
    const { organizationId } = getTenantContext();

    const patients = await this.prisma.patient.findMany({
      where: { ownerDentistId: fromDentistId },
      select: { id: true, name: true, phone: true, createdByUserId: true, ownerDentistId: true, organizationId: true },
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.patient.updateMany({
        where: { ownerDentistId: fromDentistId },
        data: { ownerDentistId: toDentistId },
      });

      for (const p of patients) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { organizationId: _orgId, ...snapshot } = p;
        await tx.patientRevision.create({
          data: {
            patientId: p.id,
            snapshot: snapshot as unknown as Prisma.InputJsonValue,
            changedById: actor.id,
            organizationId,
          },
        });
      }
    });

    return { reassigned: patients.length };
  }

  async claim(patientId: string, actor: AuthenticatedUser) {
    const { organizationId } = getTenantContext();
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId }, select: { type: true } });
    if (org?.type === "FREELANCER") throw new ForbiddenException("Não disponível para consultórios freelancer");

    const existing = await this.prisma.patient.findUnique({
      where: { id: patientId },
      include: ownerDentistInclude,
    });
    if (!existing) throw new NotFoundException("Paciente não encontrado");

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.patient.updateMany({
        where: { id: patientId, ownerDentistId: null },
        data: { ownerDentistId: actor.id },
      });
      if (updated.count === 0) {
        throw new ConflictException("Paciente já tem dentista responsável");
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { ownerDentist: _od, ...snapshot } = existing as typeof existing & { ownerDentist?: unknown };
      await tx.patientRevision.create({
        data: {
          patientId,
          snapshot: snapshot as unknown as Prisma.InputJsonValue,
          changedById: actor.id,
          organizationId,
        },
      });
      return tx.patient.findUnique({ where: { id: patientId }, include: ownerDentistInclude });
    });

    return result;
  }

  async getAccess(patientId: string, actor: AuthenticatedUser) {
    await this.patientAccess.assertPatientAccess(patientId, actor, "registry");
    const access = await this.patientAccess.accessFor(patientId, actor);
    const shares = await this.patientAccess.activeShares(patientId);
    return { ...access, activeShares: shares };
  }

  private async resolveOwnerDentistId(
    inputId: string | undefined | null,
    organizationId: string,
    actor: AuthenticatedUser,
    operation: "create" | "update",
  ): Promise<string | null> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { type: true },
    });

    if (org?.type === "FREELANCER") {
      return actor.id;
    }

    const isDentistOnly =
      actor.roles.includes("DENTIST") &&
      !actor.roles.includes("ADMIN") &&
      !actor.roles.includes("RECEPTIONIST");

    if (isDentistOnly) {
      if (operation === "create") {
        if (inputId && inputId !== actor.id) {
          throw new NotFoundException("Dentista não encontrado");
        }
        return inputId ?? actor.id;
      }
      return inputId ?? null;
    }

    if (operation === "create" && !inputId) {
      throw new BadRequestException("ownerDentistId é obrigatório para ADMIN e RECEPTIONIST");
    }

    if (!inputId) return null;

    await this.validateOwnerDentist(inputId, organizationId);
    return inputId;
  }

  private async validateOwnerDentist(dentistUserId: string, organizationId: string): Promise<void> {
    const dentist = await this.prisma.user.findUnique({
      where: { id: dentistUserId },
      select: { organizationId: true, roles: true, active: true },
    });
    if (
      !dentist ||
      dentist.organizationId !== organizationId ||
      !dentist.roles.includes("DENTIST") ||
      !dentist.active
    ) {
      throw new NotFoundException("Dentista não encontrado");
    }
  }

  private mapCpfConflict(error: unknown): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const target = error.meta?.target;
      const fields = Array.isArray(target) ? target : [];
      if (fields.includes("cpf")) {
        throw new ConflictException("CPF já cadastrado nesta organização");
      }
    }
  }
}
