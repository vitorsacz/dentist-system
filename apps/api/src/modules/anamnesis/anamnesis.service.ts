import { Injectable } from "@nestjs/common";
import type { UpsertAnamnesisInput } from "@dentist-system/shared-types";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class AnamnesisService {
  constructor(private readonly prisma: PrismaService) {}

  findByPatient(patientId: string) {
    return this.prisma.anamnesis.findUnique({ where: { patientId } });
  }

  upsert(patientId: string, input: UpsertAnamnesisInput) {
    return this.prisma.anamnesis.upsert({
      where: { patientId },
      create: { patientId, ...input },
      update: input,
    });
  }
}
