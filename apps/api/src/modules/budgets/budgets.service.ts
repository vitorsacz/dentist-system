import { Injectable, NotFoundException } from "@nestjs/common";
import type { CreateBudgetInput, UpdateBudgetStatusInput } from "@dentist-system/shared-types";
import { PrismaService } from "../../prisma/prisma.service";

const budgetInclude = {
  items: { include: { procedure: true } },
} as const;

function withTotal<T extends { items: { value: unknown }[] }>(budget: T) {
  const total = budget.items.reduce((sum, item) => sum + Number(item.value), 0);
  return { ...budget, total };
}

@Injectable()
export class BudgetsService {
  constructor(private readonly prisma: PrismaService) {}

  async listByPatient(patientId: string) {
    const budgets = await this.prisma.budget.findMany({
      where: { patientId },
      include: budgetInclude,
      orderBy: { createdAt: "desc" },
    });
    return budgets.map(withTotal);
  }

  async findOne(id: string) {
    const budget = await this.prisma.budget.findUnique({ where: { id }, include: budgetInclude });
    if (!budget) {
      throw new NotFoundException("Orçamento não encontrado");
    }
    return withTotal(budget);
  }

  async create(input: CreateBudgetInput, createdByUserId: string) {
    const budget = await this.prisma.budget.create({
      data: {
        patientId: input.patientId,
        createdByUserId,
        items: {
          create: input.items.map((item) => ({
            procedureId: item.procedureId,
            toothNumber: item.toothNumber,
            value: item.value,
            notes: item.notes,
          })),
        },
      },
      include: budgetInclude,
    });
    return withTotal(budget);
  }

  async updateStatus(id: string, input: UpdateBudgetStatusInput) {
    await this.findOne(id);
    const budget = await this.prisma.budget.update({
      where: { id },
      data: { status: input.status },
      include: budgetInclude,
    });
    return withTotal(budget);
  }
}
