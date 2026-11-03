import { Inject, Injectable } from "@nestjs/common";
import { PRISMA_SERVICE, type PrismaService } from "../../prisma/prisma.service";

export interface AuditParams {
  organizationId?: string | null;
  userId?: string | null;
  action: string;
  entity?: string;
  entityId?: string;
  // Instantâneos sanitizados: nunca gravar senha, token ou conteúdo clínico completo.
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}

export interface AuditListParams {
  organizationId: string;
  userId?: string;
  action?: string;
  from?: Date;
  to?: Date;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class AuditService {
  constructor(@Inject(PRISMA_SERVICE) private readonly prisma: PrismaService) {}

  // Falha silenciosa intencional: auditoria nunca deve quebrar a requisição
  // principal. Chame via fire-and-forget quando não precisar de garantia de
  // entrega (use await quando precisar — ex. testes).
  async log(params: AuditParams): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        organizationId: params.organizationId ?? null,
        userId: params.userId ?? null,
        action: params.action,
        entity: params.entity ?? null,
        entityId: params.entityId ?? null,
        before: params.before ?? undefined,
        after: params.after ?? undefined,
        ip: params.ip ?? null,
        userAgent: params.userAgent ?? null,
      },
    });
  }

  async list(params: AuditListParams) {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 50));
    const skip = (page - 1) * pageSize;

    const where = {
      organizationId: params.organizationId,
      ...(params.userId ? { userId: params.userId } : {}),
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
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  // Super Admin vê todos os tenants — sem filtro de organizationId.
  async listAll(params: Omit<AuditListParams, "organizationId"> & { organizationId?: string }) {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 50));
    const skip = (page - 1) * pageSize;

    const where = {
      ...(params.organizationId ? { organizationId: params.organizationId } : {}),
      ...(params.userId ? { userId: params.userId } : {}),
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
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }
}
