import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { CreatePatientInput, UpdatePatientInput } from "@dentist-system/shared-types";
import type { AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { PRISMA_SERVICE, type PrismaService } from "../../prisma/prisma.service";
import { getTenantContext } from "../../prisma/tenant-context";

@Injectable()
export class PatientsService {
  constructor(@Inject(PRISMA_SERVICE) private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.patient.findMany({
      orderBy: { name: "asc" },
      include: { ownerDentist: { select: { id: true, name: true } } },
    });
  }

  async findOne(id: string) {
    const patient = await this.prisma.patient.findUnique({
      where: { id },
      include: { ownerDentist: { select: { id: true, name: true } } },
    });
    if (!patient) {
      throw new NotFoundException("Paciente não encontrado");
    }
    return patient;
  }

  async findRevisions(patientId: string) {
    await this.findOne(patientId);
    return this.prisma.patientRevision.findMany({
      where: { patientId },
      orderBy: { changedAt: "desc" },
      include: { changedBy: { select: { id: true, name: true } } },
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
        include: { ownerDentist: { select: { id: true, name: true } } },
      });
    } catch (error) {
      this.mapCpfConflict(error);
      throw error;
    }
  }

  async update(id: string, input: UpdatePatientInput, actor: AuthenticatedUser) {
    const existing = await this.findOne(id);
    const { organizationId } = getTenantContext();

    // DENTIST-only não pode alterar ownerDentistId
    if ("ownerDentistId" in input) {
      const isDentistOnly = actor.roles.includes("DENTIST") && !actor.roles.includes("ADMIN") && !actor.roles.includes("RECEPTIONIST");
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
        await tx.patientRevision.create({
          data: {
            patientId: id,
            snapshot: existing as unknown as Prisma.InputJsonValue,
            changedById: actor.id,
            organizationId,
          },
        });

        return tx.patient.update({
          where: { id },
          data: updateData,
          include: { ownerDentist: { select: { id: true, name: true } } },
        });
      });
    } catch (error) {
      this.mapCpfConflict(error);
      throw error;
    }
  }

  // Resolve ownerDentistId seguindo as regras:
  // - FREELANCER: sempre o próprio actor, ignora input
  // - DENTIST-only no create: só pode setar a si mesmo
  // - ADMIN/RECEPTIONIST no create: obrigatório; valida org + DENTIST + active
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

    // Freelancer: responsável sempre é o próprio freelancer
    if (org?.type === "FREELANCER") {
      return actor.id;
    }

    const isDentistOnly = actor.roles.includes("DENTIST") && !actor.roles.includes("ADMIN") && !actor.roles.includes("RECEPTIONIST");

    if (isDentistOnly) {
      if (operation === "create") {
        // DENTIST só pode setar a si mesmo; se não vier, usa o próprio
        if (inputId && inputId !== actor.id) {
          throw new NotFoundException("Dentista não encontrado");
        }
        return inputId ?? actor.id;
      }
      // update sem ownerDentistId: sem-op (caller já rejeitou com 403)
      return inputId ?? null;
    }

    // ADMIN ou RECEPTIONIST
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
