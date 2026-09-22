import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { MyClinic } from "@dentist-system/shared-types";
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
}
