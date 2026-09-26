import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import {
  ACCESS,
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
export class BudgetsController {
  constructor(private readonly budgetsService: BudgetsService) {}

  @Roles(...ACCESS["budgets.read"])
  @Get()
  listByPatient(@Query("patientId") patientId: string) {
    return this.budgetsService.listByPatient(patientId);
  }

  @Roles(...ACCESS["budgets.read"])
  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.budgetsService.findOne(id);
  }

  @Roles(...ACCESS["budgets.write"])
  @Post()
  create(
    @Body(new ZodValidationPipe(createBudgetSchema)) body: CreateBudgetInput,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.budgetsService.create(body, user.id);
  }

  @Roles(...ACCESS["budgets.status"])
  @Patch(":id/status")
  updateStatus(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateBudgetStatusSchema)) body: UpdateBudgetStatusInput,
  ) {
    return this.budgetsService.updateStatus(id, body);
  }
}
