import { Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import { AUDIT_ACTION_KEY, type AuditActionMeta } from "../decorators/audit-action.decorator";
import type { AuthenticatedUser } from "../decorators/current-user.decorator";
import { AuditService } from "../../modules/audit/audit.service";

// Interceptor global opcional: registra ações marcadas com @AuditAction.
// Falha de log nunca propaga — auditoria não pode quebrar a requisição.
// Para ações que precisam de before/after, o serviço chama AuditService.log() diretamente.
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const meta = this.reflector.get<AuditActionMeta | undefined>(
      AUDIT_ACTION_KEY,
      context.getHandler(),
    );
    if (!meta) return next.handle();

    const req = context.switchToHttp().getRequest();
    const user = req.user as AuthenticatedUser | undefined;

    return next.handle().pipe(
      tap(() => {
        this.auditService
          .log({
            organizationId: user?.organizationId,
            userId: user?.id,
            action: meta.action,
            entity: meta.entity,
            entityId: req.params?.id as string | undefined,
            ip: req.ip as string | undefined,
            userAgent: req.headers?.["user-agent"] as string | undefined,
          })
          .catch(() => {});
      }),
    );
  }
}
