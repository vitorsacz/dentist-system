import { ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Role } from "@dentist-system/shared-types";
import { ROLES_KEY } from "../decorators/roles.decorator";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { ALLOW_AUTHENTICATED_KEY } from "../decorators/allow-authenticated.decorator";
import type { AuthenticatedUser } from "../decorators/current-user.decorator";

export type RoutePolicy =
  | { kind: "public" }
  | { kind: "authenticated" }
  | { kind: "roles"; roles: Role[] };

// Política de acesso de uma rota: a declarada no handler vence a da classe
// (mesma regra de override do @Roles de antes). Sem nenhuma das três em
// nenhum dos dois níveis → undefined, e o guard nega.
// Exportada pro teste de cobertura (test/route-policy-coverage.e2e-spec.ts)
// usar exatamente a mesma resolução do guard.
export function resolveRoutePolicy(
  reflector: Reflector,
  handler: object,
  controllerClass: object,
): RoutePolicy | undefined {
  for (const target of [handler, controllerClass]) {
    const roles = reflector.get<Role[] | undefined>(ROLES_KEY, target as never);
    if (roles && roles.length > 0) {
      return { kind: "roles", roles };
    }
    if (reflector.get<boolean | undefined>(IS_PUBLIC_KEY, target as never)) {
      return { kind: "public" };
    }
    if (reflector.get<boolean | undefined>(ALLOW_AUTHENTICATED_KEY, target as never)) {
      return { kind: "authenticated" };
    }
  }
  return undefined;
}

// Nega por padrão: rota sem @Public, @Roles ou @AllowAuthenticated (no
// handler ou na classe) responde 403, mesmo pra usuário autenticado. Um
// controller novo esquecido sem decorator fica fechado, não aberto a todos.
@Injectable()
export class RolesGuard {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const policy = resolveRoutePolicy(this.reflector, context.getHandler(), context.getClass());
    if (!policy) {
      throw new ForbiddenException("Sem permissão para acessar este recurso");
    }
    if (policy.kind === "public" || policy.kind === "authenticated") {
      // Autenticação já foi garantida pelo JwtAuthGuard (roda antes); este
      // guard só decide papel.
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;
    // Usuário com vários papéis passa se QUALQUER um deles estiver na lista.
    if (!user || !user.roles.some((role) => policy.roles.includes(role))) {
      throw new ForbiddenException("Sem permissão para acessar este recurso");
    }
    return true;
  }
}
