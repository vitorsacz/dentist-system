import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { CreateBudgetInput, UpdateBudgetStatusInput } from "@dentist-system/shared-types";
import { PRISMA_SERVICE, type PrismaService } from "../../prisma/prisma.service";
import { getTenantContext } from "../../prisma/tenant-context";
import { PatientsService } from "../patients/patients.service";
import { ProceduresService } from "../procedures/procedures.service";

const budgetInclude = {
  items: { include: { procedure: true } },
} as const;

function withTotal<T extends { items: { value: unknown }[] }>(budget: T) {
  const total = budget.items.reduce((sum, item) => sum + Number(item.value), 0);
  return { ...budget, total };
}

@Injectable()
export class BudgetsService {
  constructor(
    @Inject(PRISMA_SERVICE) private readonly prisma: PrismaService,
    private readonly patientsService: PatientsService,
    private readonly proceduresService: ProceduresService,
  ) {}

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
    await this.patientsService.findOne(input.patientId);
    for (const item of input.items) {
      await this.proceduresService.findOne(item.procedureId);
    }

    // BudgetItem é nested write (`items: { create: [...] }`) — a extension só
    // intercepta operações de topo do model alvo (Budget), não dispara pro
    // model aninhado. Único call site no projeto com esse formato; injeta
    // organizationId manualmente em cada item.
    const { organizationId } = getTenantContext();
    const budget = await this.prisma.budget.create({
      data: {
        patientId: input.patientId,
        createdByUserId,
        organizationId,
        items: {
          create: input.items.map((item) => ({
            procedureId: item.procedureId,
            toothNumber: item.toothNumber,
            value: item.value,
            notes: item.notes,
            organizationId,
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
