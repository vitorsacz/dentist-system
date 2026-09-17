import { ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Role } from "@dentist-system/shared-types";
import { ROLES_KEY } from "../decorators/roles.decorator";
import type { AuthenticatedUser } from "../decorators/current-user.decorator";

@Injectable()
export class RolesGuard {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;
    if (!user || !user.role || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException("Sem permissão para acessar este recurso");
    }
    return true;
  }
}
