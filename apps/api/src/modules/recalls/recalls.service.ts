import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { CreateRecallInput, UpdateRecallStatusInput } from "@dentist-system/shared-types";
import type { AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { PRISMA_SERVICE, type PrismaService } from "../../prisma/prisma.service";
import { getTenantContext } from "../../prisma/tenant-context";
import { PatientAccessService } from "../patients/patient-access.service";

@Injectable()
export class RecallsService {
  constructor(
    @Inject(PRISMA_SERVICE) private readonly prisma: PrismaService,
    private readonly patientAccess: PatientAccessService,
  ) {}

  list(actor: AuthenticatedUser) {
    return this.prisma.recall.findMany({
      where: {
        status: "PENDING",
        patient: this.patientAccess.patientWhere(actor, "registry"),
      },
      include: { patient: true },
      orderBy: { dueDate: "asc" },
    });
  }

  async create(input: CreateRecallInput, actor: AuthenticatedUser) {
    await this.patientAccess.assertPatientAccess(input.patientId, actor, "registry");
    const { organizationId } = getTenantContext();
    return this.prisma.recall.create({ data: { ...input, organizationId } });
  }

  async updateStatus(id: string, input: UpdateRecallStatusInput, actor: AuthenticatedUser) {
    const recall = await this.prisma.recall.findUnique({ where: { id }, select: { id: true, patientId: true, organizationId: true } });
    if (!recall) throw new NotFoundException("Retorno não encontrado");
    await this.patientAccess.assertPatientAccess(recall.patientId, actor, "registry");
    return this.prisma.recall.update({ where: { id }, data: { status: input.status } });
  }
}
