import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { MyClinic } from "@dentist-system/shared-types";
import { PRISMA_SERVICE, type PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class OrganizationService {
  constructor(@Inject(PRISMA_SERVICE) private readonly prisma: PrismaService) {}

  async findMine(organizationId: string): Promise<MyClinic> {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      include: { memberships: { include: { user: true }, orderBy: { createdAt: "asc" } } },
    });
    if (!organization) {
      throw new NotFoundException("Organização não encontrada");
    }

    return {
      id: organization.id,
      name: organization.name,
      members: organization.memberships.map((membership) => ({
        membershipId: membership.id,
        name: membership.user.name,
        role: membership.role,
        active: membership.active,
      })),
    };
  }
}
