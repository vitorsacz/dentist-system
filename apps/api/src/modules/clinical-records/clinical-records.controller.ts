import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import {
  ACCESS,
  createClinicalRecordSchema,
  type CreateClinicalRecordInput,
} from "@dentist-system/shared-types";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser, type AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { ClinicalRecordsService } from "./clinical-records.service";

@Controller("patients/:patientId/clinical-records")
export class ClinicalRecordsController {
  constructor(private readonly clinicalRecordsService: ClinicalRecordsService) {}

  @Roles(...ACCESS["clinical.read"])
  @Get()
  listByPatient(@Param("patientId") patientId: string) {
    return this.clinicalRecordsService.listByPatient(patientId);
  }

  @Roles(...ACCESS["clinical.write"])
  @Post()
  create(
    @Param("patientId") patientId: string,
    @Body(new ZodValidationPipe(createClinicalRecordSchema)) body: CreateClinicalRecordInput,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.clinicalRecordsService.create(patientId, body, user.id);
  }
}
