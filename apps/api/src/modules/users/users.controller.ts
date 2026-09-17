import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import {
  createTenantUserSchema,
  updateTenantUserSchema,
  resetPasswordSchema,
  type CreateTenantUserInput,
  type UpdateTenantUserInput,
  type ResetPasswordInput,
} from "@dentist-system/shared-types";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser, type AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { UsersService } from "./users.service";

@Controller("users")
@Roles("ADMIN")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  create(
    @Body(new ZodValidationPipe(createTenantUserSchema)) body: CreateTenantUserInput,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.usersService.create(body, currentUser.organizationId as string);
  }

  @Get()
  list(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.usersService.list(currentUser.organizationId as string);
  }

  @Patch(":id")
  update(
    @Param("id") userId: string,
    @Body(new ZodValidationPipe(updateTenantUserSchema)) body: UpdateTenantUserInput,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.usersService.update(userId, body, currentUser.organizationId as string, currentUser.id);
  }

  @Patch(":id/password")
  resetPassword(
    @Param("id") userId: string,
    @Body(new ZodValidationPipe(resetPasswordSchema)) body: ResetPasswordInput,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.usersService.resetPassword(userId, body, currentUser.organizationId as string);
  }
}
