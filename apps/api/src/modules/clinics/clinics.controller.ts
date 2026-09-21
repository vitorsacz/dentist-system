import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import {
  createClinicSchema,
  updateClinicSchema,
  type CreateClinicInput,
  type UpdateClinicInput,
} from "@dentist-system/shared-types";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { Roles } from "../../common/decorators/roles.decorator";
import { ClinicsService } from "./clinics.service";

@Controller("clinics")
@Roles("ADMIN", "DENTIST", "RECEPTIONIST")
export class ClinicsController {
  constructor(private readonly clinicsService: ClinicsService) {}

  @Get()
  list() {
    return this.clinicsService.list();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.clinicsService.findOne(id);
  }

  @Roles("DENTIST")
  @Post()
  create(@Body(new ZodValidationPipe(createClinicSchema)) body: CreateClinicInput) {
    return this.clinicsService.create(body);
  }

  @Roles("DENTIST")
  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateClinicSchema)) body: UpdateClinicInput,
  ) {
    return this.clinicsService.update(id, body);
  }
}
