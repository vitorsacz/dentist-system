import { Body, Controller, Get, Param, Put } from "@nestjs/common";
import {
  upsertClinicFinancialTermsSchema,
  type UpsertClinicFinancialTermsInput,
} from "@dentist-system/shared-types";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { Roles } from "../../common/decorators/roles.decorator";
import { ClinicFinancialTermsService } from "./clinic-financial-terms.service";

// Mesmo escopo de acesso de attendances/reports/financial (dado financeiro
// sensível) — ADMIN e RECEPTIONIST ficam de fora.
@Controller("clinics/:clinicId/financial-terms")
@Roles("DENTIST")
export class ClinicFinancialTermsController {
  constructor(private readonly clinicFinancialTermsService: ClinicFinancialTermsService) {}

  @Get()
  findByClinic(@Param("clinicId") clinicId: string) {
    return this.clinicFinancialTermsService.findByClinic(clinicId);
  }

  @Put()
  upsert(
    @Param("clinicId") clinicId: string,
    @Body(new ZodValidationPipe(upsertClinicFinancialTermsSchema)) body: UpsertClinicFinancialTermsInput,
  ) {
    return this.clinicFinancialTermsService.upsert(clinicId, body);
  }
}
