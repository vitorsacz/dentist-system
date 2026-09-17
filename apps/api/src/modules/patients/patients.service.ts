import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { CreatePatientInput, UpdatePatientInput } from "@dentist-system/shared-types";
import { PRISMA_SERVICE, type PrismaService } from "../../prisma/prisma.service";
import { getTenantContext } from "../../prisma/tenant-context";

@Injectable()
export class PatientsService {
  constructor(@Inject(PRISMA_SERVICE) private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.patient.findMany({ orderBy: { name: "asc" } });
  }

  async findOne(id: string) {
    const patient = await this.prisma.patient.findUnique({ where: { id } });
    if (!patient) {
      throw new NotFoundException("Paciente não encontrado");
    }
    return patient;
  }

  create(input: CreatePatientInput, createdByUserId: string) {
    const { organizationId } = getTenantContext();
    return this.prisma.patient.create({ data: { ...input, createdByUserId, organizationId } });
  }

  async update(id: string, input: UpdatePatientInput) {
    await this.findOne(id);
    return this.prisma.patient.update({ where: { id }, data: input });
  }
}
