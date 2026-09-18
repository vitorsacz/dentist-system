import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { CreateRecallInput, UpdateRecallStatusInput } from "@dentist-system/shared-types";
import { PRISMA_SERVICE, type PrismaService } from "../../prisma/prisma.service";
import { getTenantContext } from "../../prisma/tenant-context";
import { PatientsService } from "../patients/patients.service";

@Injectable()
export class RecallsService {
  constructor(
    @Inject(PRISMA_SERVICE) private readonly prisma: PrismaService,
    private readonly patientsService: PatientsService,
  ) {}

  list() {
    return this.prisma.recall.findMany({
      where: { status: "PENDING" },
      include: { patient: true },
      orderBy: { dueDate: "asc" },
    });
  }

  async create(input: CreateRecallInput) {
    await this.patientsService.findOne(input.patientId);
    const { organizationId } = getTenantContext();
    return this.prisma.recall.create({ data: { ...input, organizationId } });
  }

  async updateStatus(id: string, input: UpdateRecallStatusInput) {
    const recall = await this.prisma.recall.findUnique({ where: { id } });
    if (!recall) {
      throw new NotFoundException("Retorno não encontrado");
    }
    return this.prisma.recall.update({ where: { id }, data: { status: input.status } });
  }
}
