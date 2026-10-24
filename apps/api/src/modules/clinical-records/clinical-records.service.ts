import { Inject, Injectable } from "@nestjs/common";
import type { CreateClinicalRecordInput } from "@dentist-system/shared-types";
import type { AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { PRISMA_SERVICE, type PrismaService } from "../../prisma/prisma.service";
import { getTenantContext } from "../../prisma/tenant-context";
import { PatientAccessService } from "../patients/patient-access.service";

@Injectable()
export class ClinicalRecordsService {
  constructor(
    @Inject(PRISMA_SERVICE) private readonly prisma: PrismaService,
    private readonly patientAccess: PatientAccessService,
  ) {}

  async listByPatient(patientId: string, actor: AuthenticatedUser) {
    await this.patientAccess.assertPatientAccess(patientId, actor, "clinicalRead");
    return this.prisma.clinicalRecord.findMany({
      where: { patientId },
      orderBy: { date: "desc" },
    });
  }

  async create(patientId: string, input: CreateClinicalRecordInput, actor: AuthenticatedUser) {
    await this.patientAccess.assertPatientAccess(patientId, actor, "clinicalWrite");
    const { organizationId } = getTenantContext();
    return this.prisma.clinicalRecord.create({
      data: { ...input, patientId, createdByUserId: actor.id, organizationId },
    });
  }
}
