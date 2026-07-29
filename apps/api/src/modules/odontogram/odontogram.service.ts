import { Injectable } from "@nestjs/common";
import type { UpsertToothRecordInput } from "@dentist-system/shared-types";
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
}
