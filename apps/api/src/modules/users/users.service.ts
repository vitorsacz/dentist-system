import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException, UnprocessableEntityException } from "@nestjs/common";
import {
  PALETTE_COLOR_TOKENS,
  type CreateTenantUserInput,
  type UpdateTenantUserInput,
  type ResetPasswordInput,
  type ManagedTenantUser,
} from "@dentist-system/shared-types";
import * as bcrypt from "bcrypt";
import { AppointmentStatus, Prisma } from "@prisma/client";
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

    // 3) Capitania da clínica + proteção do founding user FREELANCER.
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { type: true, foundingAdminUserId: true },
    });
    if (target.roles.includes("ADMIN") && target.id !== currentUserId) {
      if (organization?.foundingAdminUserId !== currentUserId) {
        throw new ForbiddenException("Só o admin fundador pode gerenciar outros admins desta clínica");
      }
    }
    // Founding user de org FREELANCER deve sempre ter ADMIN e DENTIST.
    if (organization?.foundingAdminUserId === userId && organization?.type === "FREELANCER") {
      if (input.roles && (!input.roles.includes("ADMIN") || !input.roles.includes("DENTIST"))) {
        throw new UnprocessableEntityException(
          "O usuário fundador de um consultório FREELANCER não pode perder os papéis ADMIN ou DENTIST",
        );
      }
    }

    // Ganhou DENTIST e ainda não tem cor: atribui a próxima da paleta.
    const colorToken =
      input.colorToken ??
      (nextRoles.includes("DENTIST") && !target.colorToken ? await this.nextDentistColor(organizationId) : undefined);

    const { reassignTo, ...updateData } = input;
    const updatePayload = { ...updateData, ...(colorToken ? { colorToken } : {}) };

    let updated: UserRecord;
    if (input.active === false && target.roles.includes("DENTIST")) {
      // Tudo ou nada: desativação + reatribuição de pacientes/agendamentos/shares.
      updated = await this.handleDentistDeactivation(userId, organizationId, reassignTo ?? null, updatePayload);
    } else {
      updated = await this.prisma.user.update({
        where: { id: userId },
        data: updatePayload as Prisma.UserUpdateInput,
      });
    }

    if (input.active === false) {
      // Desativar derruba as sessões em todos os navegadores.
      await this.refreshSessions.revokeAllForUser(userId);
    }

    return toManagedTenantUser(updated);
  }

  private async handleDentistDeactivation(
    dentistId: string,
    organizationId: string,
    reassignTo: string | null,
    updatePayload: Record<string, unknown>,
  ): Promise<UserRecord> {
    // 2b: self-reassign is pointless and signals a caller mistake.
    if (reassignTo && reassignTo === dentistId) {
      throw new UnprocessableEntityException("reassignTo não pode ser o próprio dentista");
    }

    return this.prisma.$transaction(async (tx) => {
      // 2c: agendamentos futuros não cancelados/concluídos.
      const futureApptCount = await tx.appointment.count({
        where: {
          dentistUserId: dentistId,
          startsAt: { gt: new Date() },
          status: { notIn: [AppointmentStatus.CANCELED, AppointmentStatus.DONE] },
        },
      });
      if (futureApptCount > 0 && !reassignTo) {
        throw new ConflictException(
          `Dentista possui ${futureApptCount} agendamento(s) futuro(s). Forneça reassignTo para reatribuir ou cancele-os primeiro.`,
        );
      }

      if (reassignTo) {
        const dest = await tx.user.findFirst({
          where: { id: reassignTo, organizationId, active: true, roles: { has: "DENTIST" } },
        });
        if (!dest) throw new UnprocessableEntityException("Dentista de destino não encontrado ou inativo");
      }

      const patients = await tx.patient.findMany({
        where: { ownerDentistId: dentistId, organizationId },
        select: { id: true, name: true, phone: true, createdByUserId: true, ownerDentistId: true },
      });

      // 2a: user.update (active=false) DENTRO da transação.
      const updated = await tx.user.update({
        where: { id: dentistId },
        data: updatePayload as Prisma.UserUpdateInput,
      });

      await tx.patient.updateMany({
        where: { ownerDentistId: dentistId, organizationId },
        data: { ownerDentistId: reassignTo },
      });

      // Revoke shares where D is the grantee (D's access to others' patients).
      await tx.patientShare.updateMany({
        where: { dentistId, revokedAt: null, organizationId },
        data: { revokedAt: new Date(), revokedById: dentistId },
      });
      // Revoke shares for D's owned patients (other dentists' access to D's patients).
      const patientIds = patients.map((p) => p.id);
      if (patientIds.length > 0) {
        await tx.patientShare.updateMany({
          where: { patientId: { in: patientIds }, revokedAt: null, organizationId },
          data: { revokedAt: new Date(), revokedById: dentistId },
        });
      }

      for (const p of patients) {
        await tx.patientRevision.create({
          data: {
            patientId: p.id,
            snapshot: p as unknown as Prisma.InputJsonValue,
            changedById: dentistId,
            organizationId,
          },
        });
      }

      // 2c: reatribui agendamentos futuros quando reassignTo fornecido.
      // TODO: validação de conflito de horário não implementada — tarefa futura.
      if (reassignTo) {
        await tx.appointment.updateMany({
          where: {
            dentistUserId: dentistId,
            startsAt: { gt: new Date() },
            status: { notIn: [AppointmentStatus.CANCELED, AppointmentStatus.DONE] },
          },
          data: { dentistUserId: reassignTo },
        });
      }

      return updated as UserRecord;
    });
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
