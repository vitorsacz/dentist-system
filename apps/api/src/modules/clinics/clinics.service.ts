import { Injectable, NotFoundException } from "@nestjs/common";
import type { CreateClinicInput, UpdateClinicInput } from "@dentist-system/shared-types";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class ClinicsService {
  constructor(private readonly prisma: PrismaService) {}

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
    return this.prisma.clinic.create({ data: input });
  }

  async update(id: string, input: UpdateClinicInput) {
    await this.findOne(id);
    return this.prisma.clinic.update({ where: { id }, data: input });
  }
}
