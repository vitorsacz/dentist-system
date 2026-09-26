import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  CreateOrganizationInput,
  PlatformOrganization,
  PlatformOrganizationDetail,
} from "@dentist-system/shared-types";
import * as bcrypt from "bcrypt";
import { PRISMA_SERVICE, type PrismaService } from "../../prisma/prisma.service";

interface OrganizationRecord {
  id: string;
  name: string;
  type: PlatformOrganization["type"];
  status: PlatformOrganization["status"];
  foundingAdminUserId: string | null;
  createdAt: Date;
}

function toPlatformOrganization(organization: OrganizationRecord): PlatformOrganization {
  return {
    id: organization.id,
    name: organization.name,
    type: organization.type,
    status: organization.status,
    foundingAdminUserId: organization.foundingAdminUserId,
    createdAt: organization.createdAt.toISOString(),
  };
}

@Injectable()
export class PlatformService {
  constructor(@Inject(PRISMA_SERVICE) private readonly prisma: PrismaService) {}

  async createOrganization(input: CreateOrganizationInput): Promise<PlatformOrganization> {
    const passwordHash = await bcrypt.hash(input.foundingAdminPassword, 10);

    const organization = await this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({ data: { name: input.name } });
      const admin = await tx.user.create({
        data: {
          organizationId: org.id,
          email: input.foundingAdminEmail,
          passwordHash,
          name: input.foundingAdminName,
          roles: ["ADMIN"],
        },
      });
      return tx.organization.update({
        where: { id: org.id },
        data: { foundingAdminUserId: admin.id },
      });
    });

    return toPlatformOrganization(organization);
  }

  async list(): Promise<PlatformOrganization[]> {
    const organizations = await this.prisma.organization.findMany({ orderBy: { createdAt: "asc" } });
    return organizations.map(toPlatformOrganization);
  }

  async getOrganizationDetail(id: string): Promise<PlatformOrganizationDetail> {
    const organization = await this.prisma.organization.findUnique({
      where: { id },
      include: { foundingAdmin: { select: { name: true, email: true } } },
    });
    if (!organization) {
      throw new NotFoundException("Organização não encontrada");
    }
    return {
      ...toPlatformOrganization(organization),
      foundingAdmin: organization.foundingAdmin,
    };
  }

  // Transferência de capitania nunca é self-service — só o Super Admin,
  // via este endpoint (não existe rota equivalente pro Tenant Admin).
  async transferFoundingAdmin(organizationId: string, userId: string): Promise<PlatformOrganization> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, organizationId, roles: { has: "ADMIN" } },
    });
    if (!user) {
      throw new NotFoundException("Usuário admin não encontrado nesta organização");
    }

    const updated = await this.prisma.organization.update({
      where: { id: organizationId },
      data: { foundingAdminUserId: userId },
    });
    return toPlatformOrganization(updated);
  }
}
