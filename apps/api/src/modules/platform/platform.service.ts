import { Inject, Injectable, NotFoundException, UnprocessableEntityException } from "@nestjs/common";
import type {
  CreateOrganizationInput,
  PlatformOrganization,
  PlatformOrganizationDetail,
  UpdateOrganizationStatusInput,
} from "@dentist-system/shared-types";
import { PALETTE_COLOR_TOKENS } from "@dentist-system/shared-types";
import * as bcrypt from "bcrypt";
import { Role } from "@prisma/client";
import { RefreshSessionsService } from "../sessions/refresh-sessions.service";
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
  constructor(
    @Inject(PRISMA_SERVICE) private readonly prisma: PrismaService,
    private readonly refreshSessions: RefreshSessionsService,
  ) {}

  async createOrganization(input: CreateOrganizationInput): Promise<PlatformOrganization> {
    const passwordHash = await bcrypt.hash(input.foundingAdminPassword, 10);
    const orgType = input.type ?? "CLINIC";
    // FREELANCER founding user is also DENTIST — they are the sole practitioner.
    const foundingRoles: Role[] = orgType === "FREELANCER" ? [Role.ADMIN, Role.DENTIST] : [Role.ADMIN];
    const foundingColorToken = orgType === "FREELANCER" ? PALETTE_COLOR_TOKENS[0] : undefined;

    const organization = await this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({ data: { name: input.name, type: orgType } });
      // R3: novo admin fundador precisa trocar a senha no primeiro login.
      const admin = await tx.user.create({
        data: {
          organizationId: org.id,
          email: input.foundingAdminEmail,
          passwordHash,
          name: input.foundingAdminName,
          roles: foundingRoles,
          colorToken: foundingColorToken,
          mustChangePassword: true,
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

  // R4: suspende ou reativa organização. Revoga todas as sessões dos usuários
  // ao suspender para que o bloqueio seja imediato (sem esperar expirar o
  // access token de 15 min — o refresh é inviabilizado; o JwtStrategy já
  // bloqueia o access token ao reler org.status do banco a cada request).
  async updateOrganizationStatus(
    organizationId: string,
    input: UpdateOrganizationStatusInput,
  ): Promise<PlatformOrganization> {
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) {
      throw new NotFoundException("Organização não encontrada");
    }
    if (org.status === "DELETED") {
      throw new UnprocessableEntityException("Organização deletada não pode ser reativada ou suspensa");
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.organization.update({
        where: { id: organizationId },
        data: { status: input.status },
      });
      if (input.status === "SUSPENDED") {
        // Revoga todas as sessões ativas da org para bloqueio imediato.
        await tx.refreshSession.updateMany({
          where: { user: { organizationId }, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      return result;
    });

    return toPlatformOrganization(updated);
  }

  // R5: Super Admin recupera acesso do admin/dono — força troca de senha no
  // primeiro login após o reset. Revoga todas as sessões do usuário.
  async superAdminResetPassword(organizationId: string, userId: string, newPassword: string) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, organizationId } });
    if (!user) {
      throw new NotFoundException("Usuário não encontrado nesta organização");
    }
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: true },
    });
    await this.refreshSessions.revokeAllForUser(userId);
    return { success: true };
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
