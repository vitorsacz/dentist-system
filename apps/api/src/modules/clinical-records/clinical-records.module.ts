import { Module } from "@nestjs/common";
import { PatientsModule } from "../patients/patients.module";
import { ClinicalRecordsController } from "./clinical-records.controller";
import { ClinicalRecordsService } from "./clinical-records.service";

@Module({
  imports: [PatientsModule],
  controllers: [ClinicalRecordsController],
  providers: [ClinicalRecordsService],
})
export class ClinicalRecordsModule {}
