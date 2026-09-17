import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  CreateMembershipUserInput,
  UpdateMembershipInput,
  ResetPasswordInput,
  ManagedMembership,
} from "@dentist-system/shared-types";
import * as bcrypt from "bcrypt";
import { PRISMA_SERVICE, type PrismaService } from "../../prisma/prisma.service";
import { getTenantContext } from "../../prisma/tenant-context";

interface MembershipWithUser {
  id: string;
  role: ManagedMembership["role"];
  active: boolean;
  createdAt: Date;
  user: { id: string; email: string; name: string };
}

function toManagedMembership(membership: MembershipWithUser): ManagedMembership {
  return {
    membershipId: membership.id,
    userId: membership.user.id,
    email: membership.user.email,
    name: membership.user.name,
    role: membership.role,
    active: membership.active,
    createdAt: membership.createdAt.toISOString(),
  };
}

// User/Organization/Membership ficam de fora da extension de tenant (são o
// próprio mecanismo de resolução, não dado de negócio) — toda query aqui
// filtra organizationId manualmente via getTenantContext(), sem rede de
// segurança automática como o resto dos services tem.
@Injectable()
export class UsersService {
  constructor(@Inject(PRISMA_SERVICE) private readonly prisma: PrismaService) {}

  async create(input: CreateMembershipUserInput) {
    const { organizationId } = getTenantContext();

    let user = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (!user) {
      const passwordHash = await bcrypt.hash(input.password, 10);
      user = await this.prisma.user.create({ data: { email: input.email, passwordHash, name: input.name } });
    }

    const existingMembership = await this.prisma.membership.findUnique({
      where: { userId_organizationId: { userId: user.id, organizationId } },
    });
    if (existingMembership) {
      throw new ConflictException("Usuário já tem acesso a esta organização");
    }

    const membership = await this.prisma.membership.create({
      data: { userId: user.id, organizationId, role: input.role },
      include: { user: true },
    });
    return toManagedMembership(membership);
  }

  async list() {
    const { organizationId } = getTenantContext();
    const memberships = await this.prisma.membership.findMany({
      where: { organizationId },
      include: { user: true },
      orderBy: { createdAt: "asc" },
    });
    return memberships.map(toManagedMembership);
  }

  async update(membershipId: string, input: UpdateMembershipInput, currentMembershipId: string) {
    const { organizationId } = getTenantContext();
    const membership = await this.prisma.membership.findFirst({ where: { id: membershipId, organizationId } });
    if (!membership) {
      throw new NotFoundException("Usuário não encontrado");
    }

    if (membershipId === currentMembershipId && (input.active === false || (input.role && input.role !== "ADMIN"))) {
      throw new BadRequestException("Você não pode desativar ou rebaixar a própria conta de admin");
    }

    const updated = await this.prisma.membership.update({
      where: { id: membershipId },
      data: input,
      include: { user: true },
    });
    return toManagedMembership(updated);
  }

  async resetPassword(membershipId: string, input: ResetPasswordInput) {
    const { organizationId } = getTenantContext();
    const membership = await this.prisma.membership.findFirst({
      where: { id: membershipId, organizationId },
      include: { user: true },
    });
    if (!membership) {
      throw new NotFoundException("Usuário não encontrado");
    }

    const passwordHash = await bcrypt.hash(input.password, 10);
    const user = await this.prisma.user.update({ where: { id: membership.userId }, data: { passwordHash } });
    return toManagedMembership({ ...membership, user });
  }
}
