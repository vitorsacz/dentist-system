import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { Role } from "@dentist-system/shared-types";

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as AuthenticatedUser;
  },
);
