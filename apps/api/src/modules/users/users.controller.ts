import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import {
  createMembershipUserSchema,
  updateMembershipSchema,
  resetPasswordSchema,
  type CreateMembershipUserInput,
  type UpdateMembershipInput,
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
  create(@Body(new ZodValidationPipe(createMembershipUserSchema)) body: CreateMembershipUserInput) {
    return this.usersService.create(body);
  }

  @Get()
  list() {
    return this.usersService.list();
  }

  @Patch(":id")
  update(
    @Param("id") membershipId: string,
    @Body(new ZodValidationPipe(updateMembershipSchema)) body: UpdateMembershipInput,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.usersService.update(membershipId, body, currentUser.membershipId);
  }

  @Patch(":id/password")
  resetPassword(
    @Param("id") membershipId: string,
    @Body(new ZodValidationPipe(resetPasswordSchema)) body: ResetPasswordInput,
  ) {
    return this.usersService.resetPassword(membershipId, body);
  }
}
