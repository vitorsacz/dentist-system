import { Module } from "@nestjs/common";
import { PatientsModule } from "../patients/patients.module";
import { AnamnesisController } from "./anamnesis.controller";
import { AnamnesisService } from "./anamnesis.service";

@Module({
  imports: [PatientsModule],
  controllers: [AnamnesisController],
  providers: [AnamnesisService],
})
export class AnamnesisModule {}
