import { Module } from "@nestjs/common";
import { PatientsModule } from "../patients/patients.module";
import { ClinicsModule } from "../clinics/clinics.module";
import { AppointmentsController } from "./appointments.controller";
import { AppointmentsService } from "./appointments.service";

@Module({
  imports: [PatientsModule, ClinicsModule],
  controllers: [AppointmentsController],
  providers: [AppointmentsService],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}
