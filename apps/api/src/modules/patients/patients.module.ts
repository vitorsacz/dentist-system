import { Module } from "@nestjs/common";
import { PatientsController } from "./patients.controller";
import { PatientsService } from "./patients.service";
import { PatientAccessService } from "./patient-access.service";

@Module({
  controllers: [PatientsController],
  providers: [PatientsService, PatientAccessService],
  exports: [PatientsService, PatientAccessService],
})
export class PatientsModule {}
