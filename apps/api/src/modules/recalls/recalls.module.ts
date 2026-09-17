import { Module } from "@nestjs/common";
import { PatientsModule } from "../patients/patients.module";
import { RecallsController } from "./recalls.controller";
import { RecallsService } from "./recalls.service";

@Module({
  imports: [PatientsModule],
  controllers: [RecallsController],
  providers: [RecallsService],
})
export class RecallsModule {}
