import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import {
  upsertToothRecordSchema,
  updateToothRecordStatusSchema,
  type UpsertToothRecordInput,
  type UpdateToothRecordStatusInput,
} from "@dentist-system/shared-types";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { Roles } from "../../common/decorators/roles.decorator";
import { OdontogramService } from "./odontogram.service";

@Controller("patients/:patientId/tooth-records")
@Roles("DENTIST")
export class OdontogramController {
  constructor(private readonly odontogramService: OdontogramService) {}

  @Get()
  listByPatient(@Param("patientId") patientId: string) {
    return this.odontogramService.listByPatient(patientId);
  }

  @Post()
  create(
    @Param("patientId") patientId: string,
    @Body(new ZodValidationPipe(upsertToothRecordSchema)) body: UpsertToothRecordInput,
  ) {
    return this.odontogramService.create(patientId, body);
  }

  @Patch(":id/status")
  updateStatus(
    @Param("patientId") patientId: string,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateToothRecordStatusSchema)) body: UpdateToothRecordStatusInput,
  ) {
    return this.odontogramService.updateStatus(patientId, id, body);
  }
}
