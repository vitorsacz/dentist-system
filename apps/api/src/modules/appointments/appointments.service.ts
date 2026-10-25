import { createHash } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type {
  ConflictInfo,
  CreateAppointmentInput,
  ListAppointmentsQuery,
  UpdateAppointmentInput,
} from "@dentist-system/shared-types";
import type { AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { PRISMA_SERVICE, type PrismaService, type TenantScopedTransactionClient } from "../../prisma/prisma.service";
import { getTenantContext } from "../../prisma/tenant-context";
import { PatientAccessService } from "../patients/patient-access.service";
import { ClinicsService } from "../clinics/clinics.service";

const MAX_DURATION_MS = 8 * 60 * 60 * 1000;

function dentistLockId(dentistUserId: string): bigint {
  const hash = createHash("sha256").update(dentistUserId).digest();
  return hash.readBigInt64BE(0);
}

function isDentistOnly(actor: AuthenticatedUser): boolean {
  return actor.roles.includes("DENTIST") && !actor.roles.includes("ADMIN") && !actor.roles.includes("RECEPTIONIST");
}

@Injectable()
export class AppointmentsService {
  constructor(
    @Inject(PRISMA_SERVICE) private readonly prisma: PrismaService,
    private readonly patientAccess: PatientAccessService,
    private readonly clinicsService: ClinicsService,
  ) {}

  list(query: ListAppointmentsQuery, actor: AuthenticatedUser) {
    const windowMs = query.to.getTime() - query.from.getTime();
    if (windowMs > 42 * 24 * 60 * 60 * 1000) {
      throw new UnprocessableEntityException("Janela máxima de 42 dias");
    }

    // DENTIST-only: ignore the query param, always scope to own appointments.
    const dentistOnlyActor = isDentistOnly(actor);
    const effectiveDentistId = dentistOnlyActor ? actor.id : query.dentistUserId;

    const where = {
      startsAt: { gte: query.from, lte: query.to },
      ...(query.clinicId ? { clinicId: query.clinicId } : {}),
      ...(effectiveDentistId ? { dentistUserId: effectiveDentistId } : {}),
    };

    if (dentistOnlyActor) {
      return this.prisma.appointment.findMany({
        where,
        include: { patient: { select: { id: true, name: true, phone: true, active: true } }, clinic: true },
        orderBy: { startsAt: "asc" },
      });
    }
    return this.prisma.appointment.findMany({
      where,
      include: { patient: true, clinic: true },
      orderBy: { startsAt: "asc" },
    });
  }

  async findOne(id: string, actor?: AuthenticatedUser) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: { patient: true, clinic: true },
    });
    if (!appointment) throw new NotFoundException("Agendamento não encontrado");

    if (actor) {
      const dentistScopedOnly = actor.roles.includes("DENTIST") && !actor.roles.includes("ADMIN");
      if (dentistScopedOnly && appointment.dentistUserId !== actor.id) {
        throw new NotFoundException("Agendamento não encontrado");
      }
    }
    return appointment;
  }

  async create(input: CreateAppointmentInput, actor: AuthenticatedUser) {
    // A extension só carimba organizationId na linha criada — não sabe que
    // patientId/clinicId são FK pra outro model tenant-scoped. Reaproveita o
    // findOne() de cada service (tenant-safe de graça via o findUnique com
    // post-check) pra barrar referência cruzada entre organizações.
    const patient = await this.patientAccess.assertPatientAccess(input.patientId, actor, "registry");
    if (!patient.active) {
      throw new UnprocessableEntityException("Paciente inativo");
    }
    const clinic = await this.clinicsService.findOne(input.clinicId);
    if (!clinic.active) {
      throw new UnprocessableEntityException("Consultório inativo");
    }

    const { organizationId } = getTenantContext();
    await this.validateDentist(input.dentistUserId, organizationId, actor);
    await this.validateDentistForPatient(input.patientId, input.dentistUserId);

    if (isDentistOnly(actor) && input.startsAt < new Date()) {
      throw new UnprocessableEntityException("DENTIST não pode agendar no passado");
    }

    if (input.allowOverlap === true && isDentistOnly(actor)) {
      throw new ForbiddenException("allowOverlap não permitido para DENTIST");
    }

    const { allowOverlap, ...data } = input;

    let conflictRaw: Array<{ id: string; startsAt: Date; endsAt: Date; patientId: string }> | null = null;

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${dentistLockId(input.dentistUserId)})`;

        if (!allowOverlap) {
          const conflicts = await this.findConflicts(tx, input.dentistUserId, input.startsAt, input.endsAt);
          if (conflicts.length > 0) {
            conflictRaw = conflicts;
            throw new Error("__conflict__");
          }
        }

        return tx.appointment.create({ data: { ...data, organizationId } });
      });
      return result;
    } catch (e: unknown) {
      if (conflictRaw !== null) {
        const conflicts = await this.toConflictInfos(conflictRaw, actor);
        throw new ConflictException({ statusCode: 409, code: "SCHEDULE_CONFLICT", conflicts });
      }
      this.mapCheckViolation(e);
      throw e;
    }
  }

  async update(id: string, input: UpdateAppointmentInput, actor: AuthenticatedUser) {
    const existing = await this.findOne(id, actor);

    if (input.dentistUserId !== undefined) {
      const dentistScopedOnly = actor.roles.includes("DENTIST") && !actor.roles.includes("ADMIN");
      if (dentistScopedOnly && input.dentistUserId !== actor.id) {
        throw new ForbiddenException("DENTIST não pode alterar dentistUserId para outro dentista");
      }
      const { organizationId } = getTenantContext();
      await this.validateDentist(input.dentistUserId, organizationId, actor);
      await this.validateDentistForPatient(existing.patientId, input.dentistUserId);
    }

    if (existing.status === "DONE" || existing.status === "NO_SHOW") {
      if (input.startsAt !== undefined || input.endsAt !== undefined || input.status !== undefined) {
        throw new UnprocessableEntityException(
          "Agendamentos DONE ou NO_SHOW não podem ter horário ou status alterado",
        );
      }
    }

    if (input.allowOverlap === true && isDentistOnly(actor)) {
      throw new ForbiddenException("allowOverlap não permitido para DENTIST");
    }

    const effectiveStartsAt = input.startsAt ?? existing.startsAt;
    const effectiveEndsAt = input.endsAt ?? existing.endsAt;
    if (effectiveEndsAt <= effectiveStartsAt) {
      throw new BadRequestException("endsAt deve ser posterior a startsAt");
    }
    if (effectiveEndsAt.getTime() - effectiveStartsAt.getTime() > MAX_DURATION_MS) {
      throw new BadRequestException("Duração máxima de 8 horas");
    }

    const { allowOverlap, ...data } = input;
    const effectiveDentistId = input.dentistUserId ?? existing.dentistUserId;

    // Re-check conflicts when timing or dentist changes, or when restoring a CANCELED appointment.
    const restoringFromCanceled =
      input.status !== undefined && existing.status === "CANCELED" && input.status !== "CANCELED";
    const needsConflictCheck =
      !allowOverlap &&
      (input.startsAt !== undefined ||
        input.endsAt !== undefined ||
        input.dentistUserId !== undefined ||
        restoringFromCanceled);

    if (!needsConflictCheck) {
      try {
        return await this.prisma.appointment.update({ where: { id }, data });
      } catch (e) {
        this.mapCheckViolation(e);
        throw e;
      }
    }

    let conflictRaw: Array<{ id: string; startsAt: Date; endsAt: Date; patientId: string }> | null = null;

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${dentistLockId(effectiveDentistId)})`;

        const conflicts = await this.findConflicts(tx, effectiveDentistId, effectiveStartsAt, effectiveEndsAt, id);
        if (conflicts.length > 0) {
          conflictRaw = conflicts;
          throw new Error("__conflict__");
        }

        return tx.appointment.update({ where: { id }, data });
      });
      return result;
    } catch (e: unknown) {
      if (conflictRaw !== null) {
        const conflicts = await this.toConflictInfos(conflictRaw, actor);
        throw new ConflictException({ statusCode: 409, code: "SCHEDULE_CONFLICT", conflicts });
      }
      this.mapCheckViolation(e);
      throw e;
    }
  }

  async cancel(id: string, actor: AuthenticatedUser) {
    const existing = await this.findOne(id, actor);

    if (existing.status === "DONE" || existing.status === "NO_SHOW") {
      throw new UnprocessableEntityException("Não é possível cancelar agendamento DONE ou NO_SHOW");
    }

    if (existing.status === "CANCELED") {
      return existing;
    }

    return this.prisma.appointment.update({ where: { id }, data: { status: "CANCELED" } });
  }

  // Valida que userId pertence à mesma organização, tem papel DENTIST e está
  // ativo. Se o actor for apenas DENTIST (sem ADMIN), só pode designar a si
  // mesmo — body field, então 403.
  private async validateDentist(
    dentistUserId: string,
    organizationId: string,
    actor: AuthenticatedUser,
  ): Promise<void> {
    const dentistScopedOnly = actor.roles.includes("DENTIST") && !actor.roles.includes("ADMIN");
    if (dentistScopedOnly && dentistUserId !== actor.id) {
      throw new ForbiddenException("DENTIST não pode designar outro dentista");
    }

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
      throw new UnprocessableEntityException("Dentista inválido ou não pertence à organização");
    }
  }

  // Decisão B: dentistUserId must be owner, active share holder, or patient unassigned.
  private async validateDentistForPatient(patientId: string, dentistUserId: string): Promise<void> {
    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
      select: { ownerDentistId: true, organizationId: true },
    });
    if (!patient || patient.ownerDentistId === null) return;
    if (patient.ownerDentistId === dentistUserId) return;

    const activeShare = await this.prisma.patientShare.findUnique({
      where: { patientId_dentistId: { patientId, dentistId: dentistUserId } },
      select: { revokedAt: true, organizationId: true },
    });
    if (activeShare && activeShare.revokedAt === null) return;

    throw new UnprocessableEntityException(
      "O dentista designado não é responsável nem tem compartilhamento ativo para este paciente",
    );
  }

  private async findConflicts(
    tx: TenantScopedTransactionClient,
    dentistUserId: string,
    startsAt: Date,
    endsAt: Date,
    excludeId?: string,
  ) {
    return tx.appointment.findMany({
      where: {
        dentistUserId,
        status: { not: "CANCELED" },
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true, startsAt: true, endsAt: true, patientId: true },
    });
  }

  private async toConflictInfos(
    conflicts: Array<{ id: string; startsAt: Date; endsAt: Date; patientId: string }>,
    actor: AuthenticatedUser,
  ): Promise<ConflictInfo[]> {
    return Promise.all(
      conflicts.map(async (c) => {
        let patientName: string | null = null;
        try {
          const p = await this.patientAccess.assertPatientAccess(c.patientId, actor, "registry");
          patientName = (p as { name?: string }).name ?? null;
        } catch {
          // actor sem acesso ao paciente: omite o nome
        }
        return {
          id: c.id,
          startsAt: c.startsAt.toISOString(),
          endsAt: c.endsAt.toISOString(),
          patientName,
        };
      }),
    );
  }

  private mapCheckViolation(error: unknown): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.message.includes("Appointment_ends_after_starts")
    ) {
      throw new BadRequestException("endsAt deve ser posterior a startsAt");
    }
  }
}
