import { Inject, Injectable, NotFoundException, UnprocessableEntityException } from "@nestjs/common";
import type { CreateBudgetInput, UpdateBudgetStatusInput } from "@dentist-system/shared-types";
import type { AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { PRISMA_SERVICE, type PrismaService } from "../../prisma/prisma.service";
import { getTenantContext } from "../../prisma/tenant-context";
import { PatientAccessService } from "../patients/patient-access.service";
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
    private readonly patientAccess: PatientAccessService,
    private readonly proceduresService: ProceduresService,
  ) {}

  async listByPatient(patientId: string, actor: AuthenticatedUser) {
    await this.patientAccess.assertPatientAccess(patientId, actor, "registry");
    const budgets = await this.prisma.budget.findMany({
      where: { patientId },
      include: budgetInclude,
      orderBy: { createdAt: "desc" },
    });
    return budgets.map(withTotal);
  }

  async findOne(id: string, actor: AuthenticatedUser) {
    const budget = await this.prisma.budget.findUnique({ where: { id }, include: budgetInclude });
    if (!budget) throw new NotFoundException("Orçamento não encontrado");
    await this.patientAccess.assertPatientAccess(budget.patientId, actor, "registry");
    return withTotal(budget);
  }

  async create(input: CreateBudgetInput, actor: AuthenticatedUser) {
    const patient = await this.patientAccess.assertPatientAccess(input.patientId, actor, "registry");
    if (!patient.active) {
      throw new UnprocessableEntityException("Paciente inativo");
    }
    for (const item of input.items) {
      await this.proceduresService.findOne(item.procedureId);
    }

    // BudgetItem é nested write — injeta organizationId manualmente em cada item.
    const { organizationId } = getTenantContext();
    const budget = await this.prisma.budget.create({
      data: {
        patientId: input.patientId,
        createdByUserId: actor.id,
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

  async updateStatus(id: string, input: UpdateBudgetStatusInput, actor: AuthenticatedUser) {
    const budget = await this.prisma.budget.findUnique({ where: { id }, include: budgetInclude });
    if (!budget) throw new NotFoundException("Orçamento não encontrado");
    await this.patientAccess.assertPatientAccess(budget.patientId, actor, "registry");
    const updated = await this.prisma.budget.update({
      where: { id },
      data: { status: input.status },
      include: budgetInclude,
    });
    return withTotal(updated);
  }
}
