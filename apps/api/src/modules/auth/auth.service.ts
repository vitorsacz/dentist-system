import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import type { LoginInput, Role } from "@dentist-system/shared-types";
import * as bcrypt from "bcrypt";
import { PRISMA_SERVICE, type PrismaService } from "../../prisma/prisma.service";

const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL = "30d";

interface JwtPayload {
  sub: string;
  email: string;
  organizationId: string;
  membershipId: string;
  role: Role;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(PRISMA_SERVICE) private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(input: LoginInput) {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (!user || !user.active) {
      throw new UnauthorizedException("Credenciais inválidas");
    }

    const isValid = await bcrypt.compare(input.password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException("Credenciais inválidas");
    }

    // Hoje todo usuário real tem exatamente uma membership. Se algum dia
    // tiver mais de uma (ex.: dentista atendendo em 2 clínicas), a primeira
    // por createdAt é escolhida deterministicamente — é aqui que um seletor
    // de organização entraria no futuro, não existe hoje de propósito.
    const membership = await this.prisma.membership.findFirst({
      where: { userId: user.id, active: true },
      orderBy: { createdAt: "asc" },
    });
    if (!membership) {
      throw new UnauthorizedException("Usuário sem acesso a nenhuma organização");
    }

    return this.issueTokens(user.id, user.email, membership.organizationId, membership.id, membership.role);
  }

  async refresh(refreshToken: string | undefined) {
    if (!refreshToken) {
      throw new UnauthorizedException("Refresh token ausente");
    }

    try {
      const payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: this.configService.getOrThrow<string>("JWT_REFRESH_SECRET"),
      });
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user || !user.active) {
        throw new UnauthorizedException("Refresh token inválido");
      }

      // Ancorado na MESMA membership do token anterior (não "primeira de
      // novo") — a sessão não pula de organização sozinha se o usuário ganhar
      // uma segunda membership depois de logado.
      const membership = await this.prisma.membership.findUnique({ where: { id: payload.membershipId } });
      if (!membership || membership.userId !== user.id || !membership.active) {
        throw new UnauthorizedException("Refresh token inválido");
      }

      return this.issueTokens(user.id, user.email, membership.organizationId, membership.id, membership.role);
    } catch {
      throw new UnauthorizedException("Refresh token inválido");
    }
  }

  private issueTokens(userId: string, email: string, organizationId: string, membershipId: string, role: Role) {
    const payload: JwtPayload = { sub: userId, email, organizationId, membershipId, role };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.getOrThrow<string>("JWT_ACCESS_SECRET"),
      expiresIn: ACCESS_TOKEN_TTL,
    });
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.getOrThrow<string>("JWT_REFRESH_SECRET"),
      expiresIn: REFRESH_TOKEN_TTL,
    });

    return { accessToken, refreshToken };
  }
}
