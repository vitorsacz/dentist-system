import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { CreateClinicInput, UpdateClinicInput } from "@dentist-system/shared-types";
import { PRISMA_SERVICE, type PrismaService } from "../../prisma/prisma.service";
import { getTenantContext } from "../../prisma/tenant-context";

@Injectable()
export class ClinicsService {
  constructor(@Inject(PRISMA_SERVICE) private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.clinic.findMany({ orderBy: { name: "asc" } });
  }

  async findOne(id: string) {
    const clinic = await this.prisma.clinic.findUnique({ where: { id } });
    if (!clinic) {
      throw new NotFoundException("Consultório não encontrado");
    }
    return clinic;
  }

  create(input: CreateClinicInput) {
    const { organizationId } = getTenantContext();
    return this.prisma.clinic.create({ data: { ...input, organizationId } });
  }

  async update(id: string, input: UpdateClinicInput) {
    await this.findOne(id);
    return this.prisma.clinic.update({ where: { id }, data: input });
  }
}
