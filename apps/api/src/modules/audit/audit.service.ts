import { Inject, Injectable } from "@nestjs/common";
import { PRISMA_SERVICE, type PrismaService } from "../../prisma/prisma.service";

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
  constructor(@Inject(PRISMA_SERVICE) private readonly prisma: PrismaService) {}

  // Falha silenciosa intencional: auditoria nunca deve quebrar a requisição
  // principal. Use await quando precisar de garantia de entrega (ex. testes).
  async log(params: AuditParams): Promise<void> {
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
