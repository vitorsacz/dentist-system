import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import {
  ACCESS,
  createClinicSchema,
  updateClinicSchema,
  type CreateClinicInput,
  type UpdateClinicInput,
} from "@dentist-system/shared-types";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { Roles } from "../../common/decorators/roles.decorator";
import { ClinicsService } from "./clinics.service";

@Controller("clinics")
@Roles(...ACCESS["clinics.read"])
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
}
