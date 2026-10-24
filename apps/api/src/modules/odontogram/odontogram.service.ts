import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { UpsertToothRecordInput, UpdateToothRecordStatusInput } from "@dentist-system/shared-types";
import type { AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { PRISMA_SERVICE, type PrismaService } from "../../prisma/prisma.service";
import { getTenantContext } from "../../prisma/tenant-context";
import { PatientAccessService } from "../patients/patient-access.service";

@Injectable()
export class OdontogramService {
  constructor(
    @Inject(PRISMA_SERVICE) private readonly prisma: PrismaService,
    private readonly patientAccess: PatientAccessService,
  ) {}

  async listByPatient(patientId: string, actor: AuthenticatedUser) {
    await this.patientAccess.assertPatientAccess(patientId, actor, "clinicalRead");
    return this.prisma.toothRecord.findMany({
      where: { patientId },
      orderBy: { toothNumber: "asc" },
    });
  }

  async create(patientId: string, input: UpsertToothRecordInput, actor: AuthenticatedUser) {
    await this.patientAccess.assertPatientAccess(patientId, actor, "clinicalWrite");
    const { organizationId } = getTenantContext();
    return this.prisma.toothRecord.create({
      data: { patientId, organizationId, ...input },
    });
  }

  async updateStatus(
    patientId: string,
    id: string,
    input: UpdateToothRecordStatusInput,
    actor: AuthenticatedUser,
  ) {
    await this.patientAccess.assertPatientAccess(patientId, actor, "clinicalWrite");
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
