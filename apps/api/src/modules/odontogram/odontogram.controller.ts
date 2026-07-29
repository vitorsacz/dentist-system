import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { upsertToothRecordSchema, type UpsertToothRecordInput } from "@dentist-system/shared-types";
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
}
