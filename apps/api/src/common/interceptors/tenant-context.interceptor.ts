import { Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from "@nestjs/common";
import { Observable } from "rxjs";
import type { AuthenticatedUser } from "../decorators/current-user.decorator";
import { runWithTenantContext } from "../../prisma/tenant-context";

// Roda depois do JwtAuthGuard (Guards sempre executam antes de Interceptors no
// Nest), então request.user já existe pra rotas autenticadas. Rotas @Public()
// (login/refresh/health) não têm request.user — passam direto sem contexto de
// tenant, e nenhum model tenant-scoped deveria ser tocado nesse caminho mesmo.
// Super Admin (organizationId null) também pula o contexto — suas rotas
// (módulo platform) nunca tocam model tenant-scoped.
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;
    if (!user || !user.organizationId) {
      return next.handle();
    }
    return new Observable((subscriber) => {
      runWithTenantContext({ organizationId: user.organizationId as string }, () => {
        next.handle().subscribe(subscriber);
      });
    });
  }
}
