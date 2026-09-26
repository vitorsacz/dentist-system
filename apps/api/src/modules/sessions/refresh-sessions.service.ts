import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { PRISMA_SERVICE, type PrismaService } from "../../prisma/prisma.service";

export const REFRESH_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const USER_AGENT_MAX_LENGTH = 512;

export interface SessionClientInfo {
  userAgent?: string;
  ip?: string;
}

const INVALID_REFRESH = "Sessão expirada. Faça login novamente.";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

// Sessões de refresh revogáveis, com rotação. O refresh token é um valor
// aleatório opaco (32 bytes) que só existe no cookie httpOnly do navegador;
// o banco guarda só o SHA-256 dele. Cada rotação revoga a sessão atual e cria
// a próxima na mesma família (familyId = um login num navegador). Reusar uma
// sessão já revogada revoga a família inteira: ou o token vazou, ou quem tem
// o token novo é outra pessoa — nos dois casos, todo mundo daquela família
// precisa logar de novo.
//
// RefreshSession não tem organizationId e fica fora da extension de tenant:
// é consultada no refresh, antes de existir contexto de organização.
@Injectable()
export class RefreshSessionsService {
  constructor(@Inject(PRISMA_SERVICE) private readonly prisma: PrismaService) {}

  // Login: abre uma família nova. Aproveita pra apagar sessões já expiradas do
  // usuário (as revogadas-mas-não-expiradas ficam, pra detectar reuso).
  async start(userId: string, client: SessionClientInfo): Promise<string> {
    await this.prisma.refreshSession.deleteMany({ where: { userId, expiresAt: { lt: new Date() } } });
    const { token, data } = this.newSession(userId, randomUUID(), client);
    await this.prisma.refreshSession.create({ data });
    return token;
  }

  // Rotação: devolve o userId e o token novo. Qualquer problema vira 401 com
  // a mesma mensagem.
  async rotate(token: string | undefined, client: SessionClientInfo): Promise<{ userId: string; token: string }> {
    if (!token) {
      throw new UnauthorizedException(INVALID_REFRESH);
    }

    const session = await this.prisma.refreshSession.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!session) {
      throw new UnauthorizedException(INVALID_REFRESH);
    }
    if (session.revokedAt) {
      await this.revokeFamily(session.familyId);
      throw new UnauthorizedException(INVALID_REFRESH);
    }
    if (session.expiresAt <= new Date()) {
      throw new UnauthorizedException(INVALID_REFRESH);
    }

    // 1) Reivindica a sessão com um UPDATE condicional (WHERE revokedAt IS
    //    NULL), atômico no Postgres: se duas requisições chegam juntas com o
    //    mesmo token, a segunda espera o lock da linha por milissegundos, recebe
    //    count 0 e é tratada como reuso — igual a um token roubado.
    //    Sem transação interativa de propósito: com duas delas disputando a
    //    mesma linha, o Prisma 5.22 falha a segunda com P2028 (timeout de 2 s
    //    pra iniciar a transação) em vez de esperar o lock.
    const claimed = await this.prisma.refreshSession.updateMany({
      where: { id: session.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (claimed.count === 0) {
      await this.revokeFamily(session.familyId);
      throw new UnauthorizedException(INVALID_REFRESH);
    }

    // 2) Cria a próxima sessão e aponta a anterior pra ela, juntos. Se falhar
    //    depois do passo 1, o pior caso é o usuário logar de novo.
    const next = this.newSession(session.userId, session.familyId, client);
    await this.prisma.$transaction([
      this.prisma.refreshSession.create({ data: next.data }),
      this.prisma.refreshSession.update({ where: { id: session.id }, data: { replacedById: next.data.id } }),
    ]);
    return { userId: session.userId, token: next.token };
  }

  // Logout: revoga a família da sessão do cookie, se for do próprio usuário.
  async revokeFamilyOfToken(token: string | undefined, userId: string): Promise<void> {
    if (!token) return;
    const session = await this.prisma.refreshSession.findUnique({ where: { tokenHash: hashToken(token) } });
    if (session && session.userId === userId) {
      await this.revokeFamily(session.familyId);
    }
  }

  // "Sair de todos os dispositivos" e desativação de usuário.
  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async revokeFamily(familyId: string) {
    await this.prisma.refreshSession.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private newSession(userId: string, familyId: string, client: SessionClientInfo) {
    const token = randomBytes(32).toString("base64url");
    return {
      token,
      data: {
        id: randomUUID(),
        userId,
        familyId,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + REFRESH_SESSION_TTL_MS),
        userAgent: client.userAgent?.slice(0, USER_AGENT_MAX_LENGTH),
        ip: client.ip,
      },
    };
  }
}
