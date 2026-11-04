import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { CreateClinicalRecordInput, CreateAddendumInput } from "@dentist-system/shared-types";
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
      include: { addenda: { orderBy: { createdAt: "asc" }, include: { createdBy: { select: { id: true, name: true } } } } },
    });
  }

  async create(patientId: string, input: CreateClinicalRecordInput, actor: AuthenticatedUser) {
    await this.patientAccess.assertPatientAccess(patientId, actor, "clinicalWrite");
    const { organizationId } = getTenantContext();
    return this.prisma.clinicalRecord.create({
      data: { ...input, patientId, createdByUserId: actor.id, organizationId },
      include: { addenda: true },
    });
  }

  async createAddendum(
    patientId: string,
    recordId: string,
    input: CreateAddendumInput,
    actor: AuthenticatedUser,
  ) {
    await this.patientAccess.assertPatientAccess(patientId, actor, "clinicalWrite");
    const { organizationId } = getTenantContext();
    const record = await this.prisma.clinicalRecord.findFirst({ where: { id: recordId, patientId } });
    if (!record) throw new NotFoundException();
    return this.prisma.clinicalRecordAddendum.create({
      data: { clinicalRecordId: recordId, text: input.text, createdByUserId: actor.id, organizationId },
      include: { createdBy: { select: { id: true, name: true } } },
    });
  }
}
