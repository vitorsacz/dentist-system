import { Inject, Injectable, NotFoundException, UnprocessableEntityException } from "@nestjs/common";
import type { MyClinic, OrganizationDentist, UpdateOrganizationProfileInput } from "@dentist-system/shared-types";
import { PRISMA_SERVICE, type PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class OrganizationService {
  constructor(@Inject(PRISMA_SERVICE) private readonly prisma: PrismaService) {}

  async findMine(organizationId: string): Promise<MyClinic> {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      include: { users: { orderBy: { createdAt: "asc" } } },
    });
    if (!organization) {
      throw new NotFoundException("Organização não encontrada");
    }

    return {
      id: organization.id,
      name: organization.name,
      type: organization.type as MyClinic["type"],
      phone: organization.phone ?? null,
      email: organization.email ?? null,
      address: organization.address ?? null,
      logoDataUrl: organization.logoDataUrl ?? null,
      members: organization.users.map((user) => ({
        userId: user.id,
        name: user.name,
        roles: user.roles,
        active: user.active,
      })),
    };
  }

  async update(organizationId: string, input: UpdateOrganizationProfileInput): Promise<void> {
    const { logoDataUrl, ...rest } = input;
    if (logoDataUrl != null) {
      const base64Part = logoDataUrl.split(",")[1] ?? "";
      // Buffer.byteLength of base64 string ≈ decoded size (precise check)
      if (Buffer.byteLength(base64Part, "base64") > 300 * 1024) {
        throw new UnprocessableEntityException("Logo excede 300 KB");
      }
    }
    await this.prisma.organization.update({
      where: { id: organizationId },
      data: { ...rest, ...(logoDataUrl !== undefined ? { logoDataUrl } : {}) },
    });
  }

  // Roster pra sidebar de dentistas da Agenda — deliberadamente um método
  // (e rota) separado de findMine(): aquele é permissivo pra qualquer papel
  // autenticado (inclusive DENTIST, correto pra "Minha Clínica"); este é
  // ADMIN/RECEPTIONIST only, ver OrganizationController. Só dentista ativo
  // — inativo some do roster (histórico de agendamentos passados, quando
  // existir de verdade, continua vinculado a ele mesmo assim).
  async findDentists(organizationId: string, includeInactive = false): Promise<OrganizationDentist[]> {
    const dentists = await this.prisma.user.findMany({
      where: { organizationId, roles: { has: "DENTIST" }, ...(includeInactive ? {} : { active: true }) },
      select: { id: true, name: true, nickname: true, colorToken: true, active: true },
      orderBy: { name: "asc" },
    });
    return dentists.map((user) => ({
      id: user.id,
      name: user.name,
      nickname: user.nickname,
      colorToken: user.colorToken as OrganizationDentist["colorToken"],
      active: user.active,
    }));
  }
}
