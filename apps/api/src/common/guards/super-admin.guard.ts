import { ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "../decorators/current-user.decorator";

// Guard local, usado só no módulo platform via @UseGuards — Super Admin não é
// um Role de tenant, é uma flag separada (isSuperAdmin), então não dá pra
// reaproveitar o RolesGuard/@Roles() global pra isso.
@Injectable()
export class SuperAdminGuard {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;
    if (!user?.isSuperAdmin) {
      throw new ForbiddenException("Só o Super Admin acessa este recurso");
    }
    return true;
  }
}
