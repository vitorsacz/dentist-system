import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import type { AccountOption, LoginInput, Role } from "@dentist-system/shared-types";
import * as bcrypt from "bcrypt";
import { PRISMA_SERVICE, type PrismaService } from "../../prisma/prisma.service";
import { RefreshSessionsService, type SessionClientInfo } from "../sessions/refresh-sessions.service";
import { AuditService } from "../audit/audit.service";

const ACCESS_TOKEN_TTL = "15m";
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
  roles: Role[];
  isSuperAdmin: boolean;
}

interface AuthenticatedUserRecord {
  id: string;
  email: string;
  organizationId: string | null;
  roles: Role[];
  isSuperAdmin: boolean;
  passwordHash: string;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(PRISMA_SERVICE) private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly refreshSessions: RefreshSessionsService,
    private readonly auditService: AuditService,
  ) {}

  // Identidade é isolada por organização — o mesmo e-mail pode ter conta em
  // várias, cada uma com a própria senha. A senha é validada ANTES de revelar
  // qualquer organização: só quem acerta a senha vê onde ela confere. Nenhuma
  // resposta diferencia "e-mail inexistente" de "senha errada".
  async login(input: LoginInput, client: SessionClientInfo): Promise<LoginOutcome> {
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
      this.auditService
        .log({ action: "LOGIN_FAILURE", ip: client.ip, userAgent: client.userAgent })
        .catch(() => {});
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
      this.auditService
        .log({
          organizationId: candidates[0]?.organizationId,
          userId: candidates[0]?.id,
          action: "LOGIN_FAILURE",
          ip: client.ip,
          userAgent: client.userAgent,
        })
        .catch(() => {});
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }
    if (validAccounts.length === 1) {
      const result = await this.issueTokens(onlyAccount, client);
      this.auditService
        .log({
          organizationId: onlyAccount.organizationId,
          userId: onlyAccount.id,
          action: "LOGIN",
          ip: client.ip,
          userAgent: client.userAgent,
        })
        .catch(() => {});
      return { kind: "tokens", ...result };
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

  // Rotação do refresh token (ver RefreshSessionsService): o token do cookie
  // é trocado por um novo a cada chamada; reuso de um token antigo derruba a
  // família inteira.
  async refresh(refreshToken: string | undefined, client: SessionClientInfo) {
    const { userId, token } = await this.refreshSessions.rotate(refreshToken, client);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.active) {
      await this.refreshSessions.revokeAllForUser(userId);
      throw new UnauthorizedException("Sessão expirada. Faça login novamente.");
    }
    return { accessToken: this.signAccessToken(user), refreshToken: token };
  }

  async logout(refreshToken: string | undefined, userId: string) {
    await this.refreshSessions.revokeFamilyOfToken(refreshToken, userId);
  }

  async logoutEverywhere(userId: string) {
    await this.refreshSessions.revokeAllForUser(userId);
  }

  private async issueTokens(user: AuthenticatedUserRecord, client: SessionClientInfo) {
    return {
      accessToken: this.signAccessToken(user),
      refreshToken: await this.refreshSessions.start(user.id, client),
    };
  }

  // Access token continua JWT de 15 min, sem estado no servidor. O refresh
  // token não é mais JWT — é opaco e revogável (RefreshSessionsService).
  private signAccessToken(user: AuthenticatedUserRecord) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      organizationId: user.organizationId,
      roles: user.roles,
      isSuperAdmin: user.isSuperAdmin,
    };
    return this.jwtService.sign(payload, {
      secret: this.configService.getOrThrow<string>("JWT_ACCESS_SECRET"),
      expiresIn: ACCESS_TOKEN_TTL,
    });
  }
}
