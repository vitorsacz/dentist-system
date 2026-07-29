import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import {
  createBudgetSchema,
  updateBudgetStatusSchema,
  type CreateBudgetInput,
  type UpdateBudgetStatusInput,
} from "@dentist-system/shared-types";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { CurrentUser, type AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { BudgetsService } from "./budgets.service";

@Controller("budgets")
@Roles("DENTIST", "RECEPTIONIST")
export class BudgetsController {
  constructor(private readonly budgetsService: BudgetsService) {}

  @Get()
  listByPatient(@Query("patientId") patientId: string) {
    return this.budgetsService.listByPatient(patientId);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.budgetsService.findOne(id);
  }

  @Post()
  create(
    @Body(new ZodValidationPipe(createBudgetSchema)) body: CreateBudgetInput,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.budgetsService.create(body, user.id);
  }

  @Patch(":id/status")
  updateStatus(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateBudgetStatusSchema)) body: UpdateBudgetStatusInput,
  ) {
    return this.budgetsService.updateStatus(id, body);
  }
}
