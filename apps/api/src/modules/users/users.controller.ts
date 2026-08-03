import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import {
  createUserSchema,
  updateUserSchema,
  resetPasswordSchema,
  type CreateUserInput,
  type UpdateUserInput,
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
  create(@Body(new ZodValidationPipe(createUserSchema)) body: CreateUserInput) {
    return this.usersService.create(body);
  }

  @Get()
  list() {
    return this.usersService.list();
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateUserSchema)) body: UpdateUserInput,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.usersService.update(id, body, currentUser.id);
  }

  @Patch(":id/password")
  resetPassword(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(resetPasswordSchema)) body: ResetPasswordInput,
  ) {
    return this.usersService.resetPassword(id, body);
  }
}
