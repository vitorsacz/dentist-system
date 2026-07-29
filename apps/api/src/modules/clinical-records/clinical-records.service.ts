import { Injectable } from "@nestjs/common";
import type { CreateClinicalRecordInput } from "@dentist-system/shared-types";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class ClinicalRecordsService {
  constructor(private readonly prisma: PrismaService) {}

  listByPatient(patientId: string) {
    return this.prisma.clinicalRecord.findMany({
      where: { patientId },
      orderBy: { date: "desc" },
    });
  }

  create(patientId: string, input: CreateClinicalRecordInput, createdByUserId: string) {
    return this.prisma.clinicalRecord.create({
      data: { ...input, patientId, createdByUserId },
    });
  }
}
