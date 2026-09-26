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
import { RecallsService } from "./recalls.service";

@Controller("recalls")
@Roles(...ACCESS["recalls.manage"])
export class RecallsController {
  constructor(private readonly recallsService: RecallsService) {}

  @Get()
  list() {
    return this.recallsService.list();
  }

  @Post()
  create(@Body(new ZodValidationPipe(createRecallSchema)) body: CreateRecallInput) {
    return this.recallsService.create(body);
  }

  @Patch(":id/status")
  updateStatus(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateRecallStatusSchema)) body: UpdateRecallStatusInput,
  ) {
    return this.recallsService.updateStatus(id, body);
  }
}
