import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import {
  ACCESS,
  createClinicSchema,
  toggleClinicActiveSchema,
  updateClinicSchema,
  type CreateClinicInput,
  type ToggleClinicActiveInput,
  type UpdateClinicInput,
} from "@dentist-system/shared-types";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { CurrentUser, type AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { ClinicsService } from "./clinics.service";

@Controller("clinics")
@Roles(...ACCESS["clinics.read"])
export class ClinicsController {
  constructor(private readonly clinicsService: ClinicsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query("includeInactive") includeInactive?: string,
  ) {
    return this.clinicsService.list(user, includeInactive === "true");
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.clinicsService.findOne(id);
  }

  @Roles(...ACCESS["clinics.write"])
  @Post()
  create(@Body(new ZodValidationPipe(createClinicSchema)) body: CreateClinicInput) {
    return this.clinicsService.create(body);
  }

  @Roles(...ACCESS["clinics.write"])
  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateClinicSchema)) body: UpdateClinicInput,
  ) {
    return this.clinicsService.update(id, body);
  }

  @Roles(...ACCESS["clinics.manage"])
  @Patch(":id/active")
  toggleActive(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(toggleClinicActiveSchema)) body: ToggleClinicActiveInput,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.clinicsService.toggleActive(id, body, user);
  }
}
