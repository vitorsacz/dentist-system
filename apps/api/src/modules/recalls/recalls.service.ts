import { Injectable, NotFoundException } from "@nestjs/common";
import type { CreateRecallInput, UpdateRecallStatusInput } from "@dentist-system/shared-types";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class RecallsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.recall.findMany({
      where: { status: "PENDING" },
      include: { patient: true },
      orderBy: { dueDate: "asc" },
    });
  }

  create(input: CreateRecallInput) {
    return this.prisma.recall.create({ data: input });
  }

  async updateStatus(id: string, input: UpdateRecallStatusInput) {
    const recall = await this.prisma.recall.findUnique({ where: { id } });
    if (!recall) {
      throw new NotFoundException("Retorno não encontrado");
    }
    return this.prisma.recall.update({ where: { id }, data: { status: input.status } });
  }
}
