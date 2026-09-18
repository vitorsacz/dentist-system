import { Module } from "@nestjs/common";
import { PatientsModule } from "../patients/patients.module";
import { ProceduresModule } from "../procedures/procedures.module";
import { BudgetsController } from "./budgets.controller";
import { BudgetsService } from "./budgets.service";

@Module({
  imports: [PatientsModule, ProceduresModule],
  controllers: [BudgetsController],
  providers: [BudgetsService],
})
export class BudgetsModule {}
