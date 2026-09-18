import { Inject, BadRequestException, Injectable } from "@nestjs/common";
import type { CreateAttendanceInput } from "@dentist-system/shared-types";
import { PRISMA_SERVICE, type PrismaService, type TenantScopedTransactionClient } from "../../prisma/prisma.service";
import { getTenantContext } from "../../prisma/tenant-context";
import { PatientsService } from "../patients/patients.service";
import { ClinicsService } from "../clinics/clinics.service";
import { ProceduresService } from "../procedures/procedures.service";
import { AppointmentsService } from "../appointments/appointments.service";

@Injectable()
export class AttendancesService {
  constructor(
    @Inject(PRISMA_SERVICE) private readonly prisma: PrismaService,
    private readonly patientsService: PatientsService,
    private readonly clinicsService: ClinicsService,
    private readonly proceduresService: ProceduresService,
    private readonly appointmentsService: AppointmentsService,
  ) {}

  listByPatient(patientId: string) {
    return this.prisma.attendance.findMany({
      where: { patientId },
      include: { clinic: true, procedure: true },
      orderBy: { date: "desc" },
    });
  }

  async create(input: CreateAttendanceInput, createdByUserId: string) {
    // Mesma razão do appointments/recalls/budgets: a extension não valida FK
    // cross-tenant em create(), só carimba organizationId na linha nova.
    // Reaproveita os findOne() de cada service antes de abrir a transação.
    await this.patientsService.findOne(input.patientId);
    await this.clinicsService.findOne(input.clinicId);
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
          createdByUserId,
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
