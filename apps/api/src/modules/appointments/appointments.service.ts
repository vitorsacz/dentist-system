import { BadRequestException, Inject, Injectable, NotFoundException, UnprocessableEntityException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type {
  CreateAppointmentInput,
  ListAppointmentsQuery,
  UpdateAppointmentInput,
} from "@dentist-system/shared-types";
import type { AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { PRISMA_SERVICE, type PrismaService } from "../../prisma/prisma.service";
import { getTenantContext } from "../../prisma/tenant-context";
import { PatientAccessService } from "../patients/patient-access.service";
import { ClinicsService } from "../clinics/clinics.service";

@Injectable()
export class AppointmentsService {
  constructor(
    @Inject(PRISMA_SERVICE) private readonly prisma: PrismaService,
    private readonly patientAccess: PatientAccessService,
    private readonly clinicsService: ClinicsService,
  ) {}

  list(query: ListAppointmentsQuery, actor: AuthenticatedUser) {
    const dentistOnly = actor.roles.includes("DENTIST") && !actor.roles.includes("ADMIN");
    const baseWhere = {
      startsAt: { gte: query.from, lte: query.to },
      ...(query.clinicId ? { clinicId: query.clinicId } : {}),
      ...(dentistOnly ? { dentistUserId: actor.id } : {}),
    };

    if (dentistOnly) {
      return this.prisma.appointment.findMany({
        where: baseWhere,
        include: { patient: { select: { id: true, name: true, phone: true } }, clinic: true },
        orderBy: { startsAt: "asc" },
      });
    }
    return this.prisma.appointment.findMany({
      where: baseWhere,
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
      const dentistOnly = actor.roles.includes("DENTIST") && !actor.roles.includes("ADMIN");
      if (dentistOnly && appointment.dentistUserId !== actor.id) {
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
    await this.patientAccess.assertPatientAccess(input.patientId, actor, "registry");
    await this.clinicsService.findOne(input.clinicId);

    const { organizationId } = getTenantContext();
    await this.validateDentist(input.dentistUserId, organizationId, actor);
    await this.validateDentistForPatient(input.patientId, input.dentistUserId);

    try {
      return await this.prisma.appointment.create({ data: { ...input, organizationId } });
    } catch (error) {
      this.mapCheckViolation(error);
      throw error;
    }
  }

  async update(id: string, input: UpdateAppointmentInput, actor: AuthenticatedUser) {
    const existing = await this.findOne(id, actor);

    if (input.dentistUserId) {
      const { organizationId } = getTenantContext();
      await this.validateDentist(input.dentistUserId, organizationId, actor);
      await this.validateDentistForPatient(existing.patientId, input.dentistUserId);
    }

    // Valida endsAt > startsAt considerando os valores já gravados quando o
    // update é parcial (só um dos dois campos vem no input).
    const effectiveStartsAt = input.startsAt ?? existing.startsAt;
    const effectiveEndsAt = input.endsAt ?? existing.endsAt;
    if (effectiveEndsAt <= effectiveStartsAt) {
      throw new BadRequestException("endsAt deve ser posterior a startsAt");
    }

    try {
      return await this.prisma.appointment.update({ where: { id }, data: input });
    } catch (error) {
      this.mapCheckViolation(error);
      throw error;
    }
  }

  // Valida que userId pertence à mesma organização, tem papel DENTIST e está
  // ativo. Se o actor for apenas DENTIST (sem ADMIN), só pode designar a si
  // mesmo.
  private async validateDentist(
    dentistUserId: string,
    organizationId: string,
    actor: AuthenticatedUser,
  ): Promise<void> {
    const isDentistOnly = actor.roles.includes("DENTIST") && !actor.roles.includes("ADMIN");
    if (isDentistOnly && dentistUserId !== actor.id) {
      throw new NotFoundException("Dentista não encontrado");
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
      throw new NotFoundException("Dentista não encontrado");
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

  private mapCheckViolation(error: unknown): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.message.includes("Appointment_ends_after_starts")
    ) {
      throw new BadRequestException("endsAt deve ser posterior a startsAt");
    }
  }
}
