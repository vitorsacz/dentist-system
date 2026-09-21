import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import {
  createPatientSchema,
  updatePatientSchema,
  type CreatePatientInput,
  type UpdatePatientInput,
} from "@dentist-system/shared-types";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { CurrentUser, type AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { PatientsService } from "./patients.service";

@Controller("patients")
@Roles("ADMIN", "DENTIST", "RECEPTIONIST")
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Get()
  list() {
    return this.patientsService.list();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.patientsService.findOne(id);
  }

  @Roles("DENTIST", "RECEPTIONIST")
  @Post()
  create(
    @Body(new ZodValidationPipe(createPatientSchema)) body: CreatePatientInput,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.patientsService.create(body, user.id);
  }

  @Roles("DENTIST", "RECEPTIONIST")
  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updatePatientSchema)) body: UpdatePatientInput,
  ) {
    return this.patientsService.update(id, body);
  }
}
