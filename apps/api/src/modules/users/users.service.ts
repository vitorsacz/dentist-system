import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { CreateUserInput, UpdateUserInput } from "@dentist-system/shared-types";
import * as bcrypt from "bcrypt";
import { PrismaService } from "../../prisma/prisma.service";

const USER_SELECT = { id: true, email: true, name: true, role: true, active: true, createdAt: true } as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateUserInput) {
    const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new ConflictException("E-mail já cadastrado");
    }

    const passwordHash = await bcrypt.hash(input.password, 10);
    return this.prisma.user.create({
      data: { email: input.email, passwordHash, name: input.name, role: input.role },
      select: USER_SELECT,
    });
  }

  list() {
    return this.prisma.user.findMany({
      select: USER_SELECT,
      orderBy: { createdAt: "asc" },
    });
  }

  async update(id: string, input: UpdateUserInput, currentUserId: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException("Usuário não encontrado");
    }

    if (id === currentUserId && (input.active === false || (input.role && input.role !== "ADMIN"))) {
      throw new BadRequestException("Você não pode desativar ou rebaixar a própria conta de admin");
    }

    return this.prisma.user.update({
      where: { id },
      data: input,
      select: USER_SELECT,
    });
  }
}
