import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import {
  ACCESS,
  upsertToothRecordSchema,
  updateToothRecordStatusSchema,
  type UpsertToothRecordInput,
  type UpdateToothRecordStatusInput,
} from "@dentist-system/shared-types";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser, type AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { OdontogramService } from "./odontogram.service";

@Controller("patients/:patientId/tooth-records")
export class OdontogramController {
  constructor(private readonly odontogramService: OdontogramService) {}

  @Roles(...ACCESS["clinical.read"])
  @Get()
  listByPatient(
    @Param("patientId") patientId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.odontogramService.listByPatient(patientId, user);
  }

  @Roles(...ACCESS["clinical.write"])
  @Post()
  create(
    @Param("patientId") patientId: string,
    @Body(new ZodValidationPipe(upsertToothRecordSchema)) body: UpsertToothRecordInput,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.odontogramService.create(patientId, body, user);
  }

  @Roles(...ACCESS["clinical.write"])
  @Patch(":id/status")
  updateStatus(
    @Param("patientId") patientId: string,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateToothRecordStatusSchema)) body: UpdateToothRecordStatusInput,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.odontogramService.updateStatus(patientId, id, body, user);
  }
}
