import { BadRequestException, Injectable } from "@nestjs/common";
import type { CreateAttendanceInput } from "@dentist-system/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import type { Prisma } from "@prisma/client";

@Injectable()
export class AttendancesService {
  constructor(private readonly prisma: PrismaService) {}

  listByPatient(patientId: string) {
    return this.prisma.attendance.findMany({
      where: { patientId },
      include: { clinic: true, procedure: true },
      orderBy: { date: "desc" },
    });
  }

  create(input: CreateAttendanceInput, createdByUserId: string) {
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
        },
      });

      for (const usage of input.materialUsages) {
        await this.deductStock(tx, attendance.id, usage.materialId, usage.quantity);
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
    tx: Prisma.TransactionClient,
    attendanceId: string,
    materialId: string,
    quantity: number,
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
      data: { attendanceId, materialId, quantity },
    });
  }
}
