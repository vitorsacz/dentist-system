import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import {
  ACCESS,
  createAnamnesisQuestionSchema,
  updateAnamnesisQuestionSchema,
  reorderAnamnesisQuestionsSchema,
  type CreateAnamnesisQuestionInput,
  type UpdateAnamnesisQuestionInput,
  type ReorderAnamnesisQuestionsInput,
} from "@dentist-system/shared-types";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { Roles } from "../../common/decorators/roles.decorator";
import { AnamnesisQuestionsService } from "./anamnesis-questions.service";

@Controller("anamnesis-questions")
export class AnamnesisQuestionsController {
  constructor(private readonly service: AnamnesisQuestionsService) {}

  @Roles(...ACCESS["anamnesis.configure"])
  @Get()
  list() {
    return this.service.list();
  }

  @Roles(...ACCESS["anamnesis.configure"])
  @Get("library")
  library() {
    return this.service.library();
  }

  @Roles(...ACCESS["anamnesis.configure"])
  @Post("seed-library")
  seedLibrary() {
    return this.service.seedLibrary();
  }

  @Roles(...ACCESS["anamnesis.configure"])
  @Post()
  create(@Body(new ZodValidationPipe(createAnamnesisQuestionSchema)) body: CreateAnamnesisQuestionInput) {
    return this.service.create(body);
  }

  @Roles(...ACCESS["anamnesis.configure"])
  @Post("reorder")
  reorder(@Body(new ZodValidationPipe(reorderAnamnesisQuestionsSchema)) body: ReorderAnamnesisQuestionsInput) {
    return this.service.reorder(body);
  }

  @Roles(...ACCESS["anamnesis.configure"])
  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateAnamnesisQuestionSchema)) body: UpdateAnamnesisQuestionInput,
  ) {
    return this.service.update(id, body);
  }

  @Roles(...ACCESS["anamnesis.configure"])
  @Patch(":id/active")
  toggleActive(@Param("id") id: string) {
    return this.service.toggleActive(id);
  }

  @Roles(...ACCESS["anamnesis.configure"])
  @Delete(":id")
  softDelete(@Param("id") id: string) {
    return this.service.softDelete(id);
  }
}
