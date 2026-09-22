import { Module } from "@nestjs/common";
import { ClinicsModule } from "../clinics/clinics.module";
import { ClinicFinancialTermsController } from "./clinic-financial-terms.controller";
import { ClinicFinancialTermsService } from "./clinic-financial-terms.service";

@Module({
  imports: [ClinicsModule],
  controllers: [ClinicFinancialTermsController],
  providers: [ClinicFinancialTermsService],
})
export class ClinicFinancialTermsModule {}
