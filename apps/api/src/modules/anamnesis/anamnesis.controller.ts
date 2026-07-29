import { Body, Controller, Get, Param, Put } from "@nestjs/common";
import { upsertAnamnesisSchema, type UpsertAnamnesisInput } from "@dentist-system/shared-types";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { Roles } from "../../common/decorators/roles.decorator";
import { AnamnesisService } from "./anamnesis.service";

@Controller("patients/:patientId/anamnesis")
@Roles("DENTIST")
export class AnamnesisController {
  constructor(private readonly anamnesisService: AnamnesisService) {}

  @Get()
  findByPatient(@Param("patientId") patientId: string) {
    return this.anamnesisService.findByPatient(patientId);
  }

  @Put()
  upsert(
    @Param("patientId") patientId: string,
    @Body(new ZodValidationPipe(upsertAnamnesisSchema)) body: UpsertAnamnesisInput,
  ) {
    return this.anamnesisService.upsert(patientId, body);
  }
}
