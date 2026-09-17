import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { CreateProcedureInput, UpdateProcedureInput } from "@dentist-system/shared-types";
import { PRISMA_SERVICE, type PrismaService } from "../../prisma/prisma.service";
import { getTenantContext } from "../../prisma/tenant-context";

@Injectable()
export class ProceduresService {
  constructor(@Inject(PRISMA_SERVICE) private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.procedureCatalog.findMany({ orderBy: { name: "asc" } });
  }

  async findOne(id: string) {
    const procedure = await this.prisma.procedureCatalog.findUnique({ where: { id } });
    if (!procedure) {
      throw new NotFoundException("Procedimento não encontrado");
    }
    return procedure;
  }

  create(input: CreateProcedureInput) {
    const { organizationId } = getTenantContext();
    return this.prisma.procedureCatalog.create({ data: { ...input, organizationId } });
  }

  async update(id: string, input: UpdateProcedureInput) {
    await this.findOne(id);
    return this.prisma.procedureCatalog.update({ where: { id }, data: input });
  }
}
