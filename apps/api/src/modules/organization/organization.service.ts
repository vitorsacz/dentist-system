import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { MyClinic, OrganizationDentist } from "@dentist-system/shared-types";
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
      // role só é null pra Super Admin, que nunca pertence a uma organização.
      members: organization.users.map((user) => ({
        userId: user.id,
        name: user.name,
        role: user.role as MyClinic["members"][number]["role"],
        active: user.active,
      })),
    };
  }

  // Roster pra sidebar de dentistas da Agenda — deliberadamente um método
  // (e rota) separado de findMine(): aquele é permissivo pra qualquer papel
  // autenticado (inclusive DENTIST, correto pra "Minha Clínica"); este é
  // ADMIN/RECEPTIONIST only, ver OrganizationController. Só dentista ativo
  // — inativo some do roster (histórico de agendamentos passados, quando
  // existir de verdade, continua vinculado a ele mesmo assim).
  async findDentists(organizationId: string): Promise<OrganizationDentist[]> {
    const dentists = await this.prisma.user.findMany({
      where: { organizationId, role: "DENTIST", active: true },
      orderBy: { name: "asc" },
    });
    return dentists.map((user) => ({
      userId: user.id,
      name: user.name,
      colorToken: user.colorToken as OrganizationDentist["colorToken"],
    }));
  }
}
