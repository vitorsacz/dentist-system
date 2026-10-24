import { Module } from "@nestjs/common";
import { PatientsModule } from "../patients/patients.module";
import { OdontogramController } from "./odontogram.controller";
import { OdontogramService } from "./odontogram.service";

@Module({
  imports: [PatientsModule],
  controllers: [OdontogramController],
  providers: [OdontogramService],
})
export class OdontogramModule {}
