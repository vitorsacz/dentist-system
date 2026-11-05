import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import {
  ACCESS,
  createClinicalRecordSchema,
  createAddendumSchema,
  type CreateClinicalRecordInput,
  type CreateAddendumInput,
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
  listByPatient(
    @Param("patientId") patientId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.clinicalRecordsService.listByPatient(patientId, user);
  }

  @Roles(...ACCESS["clinical.write"])
  @Post()
  create(
    @Param("patientId") patientId: string,
    @Body(new ZodValidationPipe(createClinicalRecordSchema)) body: CreateClinicalRecordInput,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.clinicalRecordsService.create(patientId, body, user);
  }

  // VISION: adicionar @AuditAction("CLINICAL_RECORD_ADDENDUM_CREATE") aqui quando PRs #47/#50 mergearem
  @Roles(...ACCESS["clinical.write"])
  @Post(":recordId/addenda")
  createAddendum(
    @Param("patientId") patientId: string,
    @Param("recordId") recordId: string,
    @Body(new ZodValidationPipe(createAddendumSchema)) body: CreateAddendumInput,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.clinicalRecordsService.createAddendum(patientId, recordId, body, user);
  }
}
