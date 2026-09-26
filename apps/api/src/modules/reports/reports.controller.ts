import { Controller, Get, Query } from "@nestjs/common";
import { ACCESS, financialReportQuerySchema, type FinancialReportQuery } from "@dentist-system/shared-types";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { Roles } from "../../common/decorators/roles.decorator";
import { ReportsService } from "./reports.service";

@Controller("reports")
@Roles(...ACCESS["reports.financial"])
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get("financial")
  financialReport(
    @Query(new ZodValidationPipe(financialReportQuerySchema)) query: FinancialReportQuery,
  ) {
    return this.reportsService.financialReport(query);
  }
}
