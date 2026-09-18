import { Inject, Injectable } from "@nestjs/common";
import type { UpsertAnamnesisInput } from "@dentist-system/shared-types";
import { PRISMA_SERVICE, type PrismaService } from "../../prisma/prisma.service";
import { getTenantContext } from "../../prisma/tenant-context";

@Injectable()
export class AnamnesisService {
  constructor(@Inject(PRISMA_SERVICE) private readonly prisma: PrismaService) {}

  findByPatient(patientId: string) {
    return this.prisma.anamnesis.findUnique({ where: { patientId } });
  }

  upsert(patientId: string, input: UpsertAnamnesisInput) {
    const { organizationId } = getTenantContext();
    return this.prisma.anamnesis.upsert({
      where: { patientId },
      create: { patientId, organizationId, ...input },
      update: input,
    });
  }
}
