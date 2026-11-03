import { Body, Controller, Get, Param, Put } from "@nestjs/common";
import { ACCESS, upsertAnamnesisSchema, type UpsertAnamnesisInput } from "@dentist-system/shared-types";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser, type AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { AuditAction } from "../../common/decorators/audit-action.decorator";
import { AnamnesisService } from "./anamnesis.service";

@Controller("patients/:patientId/anamnesis")
export class AnamnesisController {
  constructor(private readonly anamnesisService: AnamnesisService) {}

  @Roles(...ACCESS["clinical.read"])
  @AuditAction("ANAMNESIS_READ", "Anamnesis")
  @Get()
  findByPatient(
    @Param("patientId") patientId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.anamnesisService.findByPatient(patientId, user);
  }

  @Roles(...ACCESS["clinical.write"])
  @AuditAction("ANAMNESIS_UPSERT", "Anamnesis")
  @Put()
  upsert(
    @Param("patientId") patientId: string,
    @Body(new ZodValidationPipe(upsertAnamnesisSchema)) body: UpsertAnamnesisInput,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.anamnesisService.upsert(patientId, body, user);
  }
}
