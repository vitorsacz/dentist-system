import { ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { PALETTE_COLOR_TOKENS, type CreateClinicInput, type UpdateClinicInput } from "@dentist-system/shared-types";
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

  async create(input: CreateClinicInput) {
    const { organizationId } = getTenantContext();
    // Consultório de uma clínica é fixo — só tenant tipo Freelancer pode
    // adicionar novos consultórios (representam os locais onde ele mesmo
    // atende). Ver vault: dentist-system/Roadmap.md.
    const organization = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (organization?.type === "CLINIC") {
      throw new ForbiddenException(
        "Consultórios de uma clínica são fixos — não podem ser criados por aqui.",
      );
    }
    // Cor opcional — se não vier, cicla a paleta pelo nº de consultórios que
    // o tenant já tem (mesma lógica que antes vivia no front).
    let colorToken = input.colorToken;
    if (!colorToken) {
      const existingCount = await this.prisma.clinic.count({ where: { organizationId } });
      colorToken = PALETTE_COLOR_TOKENS[existingCount % PALETTE_COLOR_TOKENS.length];
    }

    return this.prisma.clinic.create({ data: { ...input, colorToken, organizationId } });
  }

  async update(id: string, input: UpdateClinicInput) {
    await this.findOne(id);
    return this.prisma.clinic.update({ where: { id }, data: input });
  }
}
