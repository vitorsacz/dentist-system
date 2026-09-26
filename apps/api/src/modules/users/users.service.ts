import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  PALETTE_COLOR_TOKENS,
  type CreateTenantUserInput,
  type UpdateTenantUserInput,
  type ResetPasswordInput,
  type ManagedTenantUser,
} from "@dentist-system/shared-types";
import * as bcrypt from "bcrypt";
import { PRISMA_SERVICE, type PrismaService } from "../../prisma/prisma.service";
import { RefreshSessionsService } from "../sessions/refresh-sessions.service";

interface UserRecord {
  id: string;
  email: string;
  name: string;
  roles: ManagedTenantUser["roles"];
  active: boolean;
  colorToken: ManagedTenantUser["colorToken"];
  createdAt: Date;
}

function toManagedTenantUser(user: UserRecord): ManagedTenantUser {
  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    roles: user.roles,
    active: user.active,
    colorToken: user.colorToken,
    createdAt: user.createdAt.toISOString(),
  };
}

// User fica fora da extension de tenant (é o próprio mecanismo de resolução —
// login precisa buscar por e-mail sem saber a organização ainda) — toda query
// aqui filtra organizationId manualmente, sem rede de segurança automática.
@Injectable()
export class UsersService {
  constructor(
    @Inject(PRISMA_SERVICE) private readonly prisma: PrismaService,
    private readonly refreshSessions: RefreshSessionsService,
  ) {}

  async create(input: CreateTenantUserInput, organizationId: string) {
    // Checagem de e-mail já existente só dentro do próprio tenant — nunca
    // revela se aquele e-mail existe em outra organização.
    const existing = await this.prisma.user.findFirst({ where: { organizationId, email: input.email } });
    if (existing) {
      throw new ConflictException("E-mail já cadastrado nesta organização");
    }

    // Todo dentista tem cor (identidade na sidebar da Agenda). Se não vier,
    // cicla a paleta pelo nº de dentistas que o tenant já tem.
    let colorToken = input.colorToken;
    if (!colorToken && input.roles.includes("DENTIST")) {
      colorToken = await this.nextDentistColor(organizationId);
    }

    const passwordHash = await bcrypt.hash(input.password, 10);
    const user = await this.prisma.user.create({
      data: {
        organizationId,
        email: input.email,
        passwordHash,
        name: input.name,
        roles: input.roles,
        colorToken,
      },
    });
    return toManagedTenantUser(user);
  }

  async list(organizationId: string) {
    const users = await this.prisma.user.findMany({
      where: { organizationId },
      orderBy: { createdAt: "asc" },
    });
    return users.map(toManagedTenantUser);
  }

  async update(userId: string, input: UpdateTenantUserInput, organizationId: string, currentUserId: string) {
    const target = await this.prisma.user.findFirst({ where: { id: userId, organizationId } });
    if (!target) {
      throw new NotFoundException("Usuário não encontrado");
    }

    const nextRoles = input.roles ?? target.roles;
    const nextActive = input.active ?? target.active;

    // 1) A organização nunca fica sem admin ativo. Checado primeiro: é o que
    //    barra o único admin tentando se rebaixar ou se desativar.
    const losesActiveAdmin =
      target.active && target.roles.includes("ADMIN") && (!nextActive || !nextRoles.includes("ADMIN"));
    if (losesActiveAdmin) {
      const otherActiveAdmins = await this.prisma.user.count({
        where: { organizationId, active: true, roles: { has: "ADMIN" }, id: { not: userId } },
      });
      if (otherActiveAdmins === 0) {
        throw new BadRequestException("A organização precisa de pelo menos um admin ativo");
      }
    }

    // 2) O admin não se desativa nem remove o próprio papel de ADMIN (evita se
    //    trancar fora do sistema).
    if (userId === currentUserId && (input.active === false || (input.roles && !input.roles.includes("ADMIN")))) {
      throw new BadRequestException("Você não pode desativar ou rebaixar a própria conta de admin");
    }

    // 3) Capitania da clínica: só o admin fundador pode editar/desativar outro admin.
    if (target.roles.includes("ADMIN") && target.id !== currentUserId) {
      const organization = await this.prisma.organization.findUnique({ where: { id: organizationId } });
      if (organization?.foundingAdminUserId !== currentUserId) {
        throw new ForbiddenException("Só o admin fundador pode gerenciar outros admins desta clínica");
      }
    }

    // Ganhou DENTIST e ainda não tem cor: atribui a próxima da paleta.
    const colorToken =
      input.colorToken ??
      (nextRoles.includes("DENTIST") && !target.colorToken ? await this.nextDentistColor(organizationId) : undefined);

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { ...input, ...(colorToken ? { colorToken } : {}) },
    });
    // Desativar derruba as sessões em todos os navegadores: sem isso o
    // refresh seguiria funcionando até o token expirar.
    if (input.active === false) {
      await this.refreshSessions.revokeAllForUser(userId);
    }
    return toManagedTenantUser(updated);
  }

  private async nextDentistColor(organizationId: string) {
    const existingDentists = await this.prisma.user.count({ where: { organizationId, roles: { has: "DENTIST" } } });
    return PALETTE_COLOR_TOKENS[existingDentists % PALETTE_COLOR_TOKENS.length];
  }

  async resetPassword(userId: string, input: ResetPasswordInput, organizationId: string) {
    const target = await this.prisma.user.findFirst({ where: { id: userId, organizationId } });
    if (!target) {
      throw new NotFoundException("Usuário não encontrado");
    }

    const passwordHash = await bcrypt.hash(input.password, 10);
    const updated = await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    return toManagedTenantUser(updated);
  }
}
