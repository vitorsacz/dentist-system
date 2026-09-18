import { Module } from "@nestjs/common";
import { PatientsModule } from "../patients/patients.module";
import { ClinicsModule } from "../clinics/clinics.module";
import { ProceduresModule } from "../procedures/procedures.module";
import { AppointmentsModule } from "../appointments/appointments.module";
import { AttendancesController } from "./attendances.controller";
import { AttendancesService } from "./attendances.service";

@Module({
  imports: [PatientsModule, ClinicsModule, ProceduresModule, AppointmentsModule],
  controllers: [AttendancesController],
  providers: [AttendancesService],
})
export class AttendancesModule {}
