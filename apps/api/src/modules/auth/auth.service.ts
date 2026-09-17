import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import type { LoginInput, LookupAccountsResult, Role } from "@dentist-system/shared-types";
import * as bcrypt from "bcrypt";
import { PRISMA_SERVICE, type PrismaService } from "../../prisma/prisma.service";

const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL = "30d";

interface JwtPayload {
  sub: string;
  email: string;
  organizationId: string | null;
  role: Role | null;
  isSuperAdmin: boolean;
}

interface AuthenticatedUserRecord {
  id: string;
  email: string;
  organizationId: string | null;
  role: Role | null;
  isSuperAdmin: boolean;
  passwordHash: string;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(PRISMA_SERVICE) private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  // Identidade é isolada por tenant — um e-mail pode existir em mais de uma
  // organização (contas completamente independentes). Essa busca é
  // deliberadamente global (sem organizationId), porque nesse ponto do fluxo
  // ainda não sabemos qual organização o usuário quer acessar.
  async lookupAccounts(identifier: string): Promise<LookupAccountsResult> {
    const users = await this.prisma.user.findMany({
      where: { active: true, OR: [{ email: identifier }, { nickname: identifier }] },
      include: { organization: true },
    });

    if (users.length <= 1) {
      return { requiresOrganizationSelection: false, accounts: [] };
    }

    return {
      requiresOrganizationSelection: true,
      accounts: users.map((user) => ({
        organizationId: user.organizationId ?? "",
        organizationName: user.organization?.name ?? "",
      })),
    };
  }

  async login(input: LoginInput) {
    const { identifier, password, organizationId } = input;

    const where = organizationId
      ? { organizationId, active: true, OR: [{ email: identifier }, { nickname: identifier }] }
      : { active: true, OR: [{ email: identifier }, { nickname: identifier }] };

    const users = await this.prisma.user.findMany({ where });
    // 0 contas: não existe. Mais de 1: ambíguo, precisa organizationId (o
    // front deveria ter chamado lookupAccounts antes e nunca chegar aqui sem
    // ele). Em ambos os casos, mesma mensagem genérica — não revela qual caso é.
    const [user] = users;
    if (users.length !== 1 || !user) {
      throw new UnauthorizedException("Credenciais inválidas");
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException("Credenciais inválidas");
    }

    return this.issueTokens(user);
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

      return this.issueTokens(user);
    } catch {
      throw new UnauthorizedException("Refresh token inválido");
    }
  }

  private issueTokens(user: AuthenticatedUserRecord) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      organizationId: user.organizationId,
      role: user.role,
      isSuperAdmin: user.isSuperAdmin,
    };

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
