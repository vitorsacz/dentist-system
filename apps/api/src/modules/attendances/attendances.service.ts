import { Inject, BadRequestException, Injectable, UnprocessableEntityException } from "@nestjs/common";
import type { CreateAttendanceInput } from "@dentist-system/shared-types";
import type { AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { PRISMA_SERVICE, type PrismaService, type TenantScopedTransactionClient } from "../../prisma/prisma.service";
import { getTenantContext } from "../../prisma/tenant-context";
import { PatientAccessService } from "../patients/patient-access.service";
import { ClinicsService } from "../clinics/clinics.service";
import { ProceduresService } from "../procedures/procedures.service";
import { AppointmentsService } from "../appointments/appointments.service";

@Injectable()
export class AttendancesService {
  constructor(
    @Inject(PRISMA_SERVICE) private readonly prisma: PrismaService,
    private readonly patientAccess: PatientAccessService,
    private readonly clinicsService: ClinicsService,
    private readonly proceduresService: ProceduresService,
    private readonly appointmentsService: AppointmentsService,
  ) {}

  listByPatient(patientId: string, actor: AuthenticatedUser) {
    return this.prisma.attendance.findMany({
      where: {
        patientId,
        patient: this.patientAccess.patientWhere(actor, "clinicalRead"),
        // DENTIST vê só os próprios atendimentos financeiros
        ...(actor.roles.includes("DENTIST") && !actor.roles.includes("ADMIN")
          ? { dentistUserId: actor.id }
          : {}),
      },
      include: { clinic: true, procedure: true },
      orderBy: { date: "desc" },
    });
  }

  async create(input: CreateAttendanceInput, actor: AuthenticatedUser) {
    // clinicalWrite: paciente no escopo do actor
    const patient = await this.patientAccess.assertPatientAccess(input.patientId, actor, "clinicalWrite");
    if (!patient.active) {
      throw new UnprocessableEntityException("Paciente inativo");
    }
    const clinic = await this.clinicsService.findOne(input.clinicId);
    if (!clinic.active) {
      throw new UnprocessableEntityException("Consultório inativo");
    }
    await this.proceduresService.findOne(input.procedureId);
    if (input.appointmentId) {
      await this.appointmentsService.findOne(input.appointmentId);
    }

    const { organizationId } = getTenantContext();

    return this.prisma.$transaction(async (tx) => {
      const attendance = await tx.attendance.create({
        data: {
          patientId: input.patientId,
          appointmentId: input.appointmentId,
          clinicId: input.clinicId,
          procedureId: input.procedureId,
          date: input.date,
          grossValue: input.grossValue,
          repassePercentage: input.repassePercentage,
          materialCost: input.materialCost,
          createdByUserId: actor.id,
          dentistUserId: actor.id,
          organizationId,
        },
      });

      for (const usage of input.materialUsages) {
        await this.deductStock(tx, attendance.id, usage.materialId, usage.quantity, organizationId);
      }

      if (input.appointmentId) {
        await tx.appointment.update({
          where: { id: input.appointmentId },
          data: { status: "DONE" },
        });
      }

      return tx.attendance.findUniqueOrThrow({
        where: { id: attendance.id },
        include: { clinic: true, procedure: true, materialUsages: { include: { material: true } } },
      });
    });
  }

  // Baixa por lote seguindo FEFO (usa primeiro o lote que vence mais cedo).
  private async deductStock(
    tx: TenantScopedTransactionClient,
    attendanceId: string,
    materialId: string,
    quantity: number,
    organizationId: string,
  ) {
    const batches = await tx.materialBatch.findMany({
      where: { materialId, quantity: { gt: 0 } },
      orderBy: [{ expiryDate: { sort: "asc", nulls: "last" } }, { receivedAt: "asc" }],
    });

    let remaining = quantity;
    for (const batch of batches) {
      if (remaining <= 0) break;
      const available = Number(batch.quantity);
      const used = Math.min(available, remaining);
      await tx.materialBatch.update({
        where: { id: batch.id },
        data: { quantity: { decrement: used } },
      });
      remaining -= used;
    }

    if (remaining > 0) {
      throw new BadRequestException(
        `Estoque insuficiente para o material ${materialId} (faltam ${remaining})`,
      );
    }

    await tx.materialUsage.create({
      data: { attendanceId, materialId, quantity, organizationId },
    });
  }
}
