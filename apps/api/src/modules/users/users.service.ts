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
  role: ManagedTenantUser["role"] | null;
  active: boolean;
  colorToken: ManagedTenantUser["colorToken"];
  createdAt: Date;
}

function toManagedTenantUser(user: UserRecord): ManagedTenantUser {
  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    // role só é null pra Super Admin, que nunca aparece nesta lista (ela é
    // sempre filtrada por organizationId) — seguro converter aqui.
    role: user.role as ManagedTenantUser["role"],
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

    // Cor opcional, relevante só pra DENTIST (identidade na sidebar da
    // Agenda) — se não vier, cicla a paleta pelo nº de dentistas que o
    // tenant já tem (mesma lógica que antes vivia no front/localStorage).
    let colorToken = input.colorToken;
    if (!colorToken && input.role === "DENTIST") {
      const existingDentists = await this.prisma.user.count({ where: { organizationId, role: "DENTIST" } });
      colorToken = PALETTE_COLOR_TOKENS[existingDentists % PALETTE_COLOR_TOKENS.length];
    }

    const passwordHash = await bcrypt.hash(input.password, 10);
    const user = await this.prisma.user.create({
      data: {
        organizationId,
        email: input.email,
        passwordHash,
        name: input.name,
        role: input.role,
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

    if (userId === currentUserId && (input.active === false || (input.role && input.role !== "ADMIN"))) {
      throw new BadRequestException("Você não pode desativar ou rebaixar a própria conta de admin");
    }

    // Capitania da clínica: só o admin fundador pode editar/desativar outro admin.
    if (target.role === "ADMIN" && target.id !== currentUserId) {
      const organization = await this.prisma.organization.findUnique({ where: { id: organizationId } });
      if (organization?.foundingAdminUserId !== currentUserId) {
        throw new ForbiddenException("Só o admin fundador pode gerenciar outros admins desta clínica");
      }
    }

    const updated = await this.prisma.user.update({ where: { id: userId }, data: input });
    // Desativar derruba as sessões em todos os navegadores: sem isso o
    // refresh seguiria funcionando até o token expirar.
    if (input.active === false) {
      await this.refreshSessions.revokeAllForUser(userId);
    }
    return toManagedTenantUser(updated);
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
