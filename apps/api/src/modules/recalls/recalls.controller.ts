import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import {
  ACCESS,
  createRecallSchema,
  updateRecallStatusSchema,
  type CreateRecallInput,
  type UpdateRecallStatusInput,
} from "@dentist-system/shared-types";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser, type AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { RecallsService } from "./recalls.service";

@Controller("recalls")
@Roles(...ACCESS["recalls.manage"])
export class RecallsController {
  constructor(private readonly recallsService: RecallsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.recallsService.list(user);
  }

  @Post()
  create(
    @Body(new ZodValidationPipe(createRecallSchema)) body: CreateRecallInput,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.recallsService.create(body, user);
  }

  @Patch(":id/status")
  updateStatus(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateRecallStatusSchema)) body: UpdateRecallStatusInput,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.recallsService.updateStatus(id, body, user);
  }
}
