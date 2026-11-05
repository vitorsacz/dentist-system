import { Inject, Injectable } from "@nestjs/common";
import { PRISMA_SERVICE, type PrismaService } from "../../prisma/prisma.service";

// LOGIN_FAILURE sem usuário identificado (actorType SYSTEM) pode ser gerado em
// massa por scanners de credenciais. Esta janela deduplicado por IP evita
// inchar o banco: no máximo um registro por IP a cada 5 minutos.
const SYSTEM_THROTTLE_MS = 5 * 60 * 1000;

export type AuditActorType = "USER" | "SUPER_ADMIN" | "SYSTEM";

export interface AuditParams {
  organizationId?: string | null;
  actorId?: string | null;
  actorType: AuditActorType;
  action: string;
  targetType?: string;
  targetId?: string;
  // Payload livre: IP, userAgent, campos alterados, motivo, etc.
  // Nunca incluir senha, token ou conteúdo clínico completo.
  meta?: Record<string, unknown>;
}

export interface AuditListParams {
  organizationId: string;
  actorId?: string;
  action?: string;
  from?: Date;
  to?: Date;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class AuditService {
  // Mapa em memória: `${ip}:${action}` → timestamp do último registro.
  // Singleton do NestJS — funciona dentro de um processo; em multi-réplica
  // cada instância tem sua janela própria, o que ainda reduz >90% do volume.
  private readonly systemThrottle = new Map<string, number>();

  constructor(@Inject(PRISMA_SERVICE) private readonly prisma: PrismaService) {}

  // Falha silenciosa intencional: auditoria nunca deve quebrar a requisição
  // principal. Use await quando precisar de garantia de entrega (ex. testes).
  async log(params: AuditParams): Promise<void> {
    if (params.actorType === "SYSTEM" && typeof params.meta?.ip === "string") {
      const key = `${params.meta.ip}:${params.action}`;
      const last = this.systemThrottle.get(key) ?? 0;
      if (Date.now() - last < SYSTEM_THROTTLE_MS) return;
      this.systemThrottle.set(key, Date.now());
    }

    await this.prisma.auditLog.create({
      data: {
        organizationId: params.organizationId ?? null,
        actorId: params.actorId ?? null,
        actorType: params.actorType,
        action: params.action,
        targetType: params.targetType ?? null,
        targetId: params.targetId ?? null,
        meta: params.meta ?? undefined,
      },
    });
  }

  async list(params: AuditListParams) {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 50));
    const skip = (page - 1) * pageSize;

    const where = {
      organizationId: params.organizationId,
      ...(params.actorId ? { actorId: params.actorId } : {}),
      ...(params.action ? { action: params.action } : {}),
      ...(params.from || params.to
        ? {
            createdAt: {
              ...(params.from ? { gte: params.from } : {}),
              ...(params.to ? { lte: params.to } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: pageSize }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async listAll(params: Omit<AuditListParams, "organizationId"> & { organizationId?: string }) {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 50));
    const skip = (page - 1) * pageSize;

    const where = {
      ...(params.organizationId ? { organizationId: params.organizationId } : {}),
      ...(params.actorId ? { actorId: params.actorId } : {}),
      ...(params.action ? { action: params.action } : {}),
      ...(params.from || params.to
        ? {
            createdAt: {
              ...(params.from ? { gte: params.from } : {}),
              ...(params.to ? { lte: params.to } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: pageSize }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }
}
