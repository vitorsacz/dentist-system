import { Injectable, NotFoundException } from "@nestjs/common";
import type { UpsertToothRecordInput, UpdateToothRecordStatusInput } from "@dentist-system/shared-types";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class OdontogramService {
  constructor(private readonly prisma: PrismaService) {}

  listByPatient(patientId: string) {
    return this.prisma.toothRecord.findMany({
      where: { patientId },
      orderBy: { toothNumber: "asc" },
    });
  }

  create(patientId: string, input: UpsertToothRecordInput) {
    return this.prisma.toothRecord.create({
      data: { patientId, ...input },
    });
  }

  async updateStatus(patientId: string, id: string, input: UpdateToothRecordStatusInput) {
    const record = await this.prisma.toothRecord.findUnique({ where: { id } });
    if (!record || record.patientId !== patientId) {
      throw new NotFoundException("Registro não encontrado");
    }

    return this.prisma.toothRecord.update({
      where: { id },
      data: { status: input.status },
    });
  }
}
