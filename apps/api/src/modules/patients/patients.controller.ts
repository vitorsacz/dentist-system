import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import {
  ACCESS,
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
@Roles(...ACCESS["patients.read"])
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

  @Roles(...ACCESS["patients.write"])
  @Post()
  create(
    @Body(new ZodValidationPipe(createPatientSchema)) body: CreatePatientInput,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.patientsService.create(body, user.id);
  }

  @Roles(...ACCESS["patients.write"])
  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updatePatientSchema)) body: UpdatePatientInput,
  ) {
    return this.patientsService.update(id, body);
  }
}
