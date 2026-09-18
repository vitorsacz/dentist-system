import { Inject, Injectable } from "@nestjs/common";
import type { CreateClinicalRecordInput } from "@dentist-system/shared-types";
import { PRISMA_SERVICE, type PrismaService } from "../../prisma/prisma.service";
import { getTenantContext } from "../../prisma/tenant-context";

@Injectable()
export class ClinicalRecordsService {
  constructor(@Inject(PRISMA_SERVICE) private readonly prisma: PrismaService) {}

  listByPatient(patientId: string) {
    return this.prisma.clinicalRecord.findMany({
      where: { patientId },
      orderBy: { date: "desc" },
    });
  }

  create(patientId: string, input: CreateClinicalRecordInput, createdByUserId: string) {
    const { organizationId } = getTenantContext();
    return this.prisma.clinicalRecord.create({
      data: { ...input, patientId, createdByUserId, organizationId },
    });
  }
}
