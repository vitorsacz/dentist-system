import { Inject, Injectable } from "@nestjs/common";
import type { UpsertAnamnesisInput } from "@dentist-system/shared-types";
import type { AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { PRISMA_SERVICE, type PrismaService } from "../../prisma/prisma.service";
import { getTenantContext } from "../../prisma/tenant-context";
import { PatientAccessService } from "../patients/patient-access.service";

@Injectable()
export class AnamnesisService {
  constructor(
    @Inject(PRISMA_SERVICE) private readonly prisma: PrismaService,
    private readonly patientAccess: PatientAccessService,
  ) {}

  async findByPatient(patientId: string, actor: AuthenticatedUser) {
    await this.patientAccess.assertPatientAccess(patientId, actor, "clinicalRead");
    return this.prisma.anamnesis.findUnique({ where: { patientId } });
  }

  async upsert(patientId: string, input: UpsertAnamnesisInput, actor: AuthenticatedUser) {
    await this.patientAccess.assertPatientAccess(patientId, actor, "clinicalWrite");
    const { organizationId } = getTenantContext();
    return this.prisma.anamnesis.upsert({
      where: { patientId },
      create: { patientId, organizationId, ...input },
      update: input,
    });
  }
}
