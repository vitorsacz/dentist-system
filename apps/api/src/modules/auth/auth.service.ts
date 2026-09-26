import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import type { AccountOption, LoginInput, Role } from "@dentist-system/shared-types";
import * as bcrypt from "bcrypt";
import { PRISMA_SERVICE, type PrismaService } from "../../prisma/prisma.service";

const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL = "30d";
const BCRYPT_ROUNDS = 10;

// Hash de uma senha que ninguém tem, comparado quando o identifier não bate
// com nenhuma conta — assim "e-mail inexistente" gasta o mesmo bcrypt.compare
// que "senha errada" e o tempo de resposta não revela se o e-mail existe.
// Mesmo custo (rounds) dos hashes reais.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync("conta-inexistente-comparacao-de-tempo", BCRYPT_ROUNDS);

const INVALID_CREDENTIALS = "Credenciais inválidas";

export type LoginOutcome =
  | { kind: "tokens"; accessToken: string; refreshToken: string }
  | { kind: "organization-selection"; accounts: AccountOption[] };

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

  // Identidade é isolada por organização — o mesmo e-mail pode ter conta em
  // várias, cada uma com a própria senha. A senha é validada ANTES de revelar
  // qualquer organização: só quem acerta a senha vê onde ela confere. Nenhuma
  // resposta diferencia "e-mail inexistente" de "senha errada".
  async login(input: LoginInput): Promise<LoginOutcome> {
    const { identifier, password, organizationId } = input;

    // Busca global (sem tenant no contexto): User fica fora da extension de
    // isolamento justamente pra isso — ver tenant.extension.ts.
    const candidates = await this.prisma.user.findMany({
      where: {
        active: true,
        OR: [{ email: identifier }, { nickname: identifier }],
        ...(organizationId ? { organizationId } : {}),
      },
      include: { organization: { select: { name: true } } },
    });

    if (candidates.length === 0) {
      await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    const validAccounts: typeof candidates = [];
    for (const candidate of candidates) {
      if (await bcrypt.compare(password, candidate.passwordHash)) {
        validAccounts.push(candidate);
      }
    }

    const [onlyAccount] = validAccounts;
    if (!onlyAccount) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }
    if (validAccounts.length === 1) {
      return { kind: "tokens", ...this.issueTokens(onlyAccount) };
    }

    // Senha confere em mais de uma conta: o usuário escolhe a organização e
    // reenvia com organizationId (senha validada de novo). Conta sem
    // organização (Super Admin) não entra na lista — não há organizationId
    // pra reenviar; Super Admin com e-mail e senha repetidos entra pelo
    // nickname, que é único globalmente.
    return {
      kind: "organization-selection",
      accounts: validAccounts.flatMap((account) =>
        account.organizationId && account.organization
          ? [{ organizationId: account.organizationId, organizationName: account.organization.name }]
          : [],
      ),
    };
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
