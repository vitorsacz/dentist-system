import { Controller, Get, Query, Res } from "@nestjs/common";
import type { Response } from "express";
import { ACCESS, financialReportQuerySchema, type FinancialReportQuery } from "@dentist-system/shared-types";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser, type AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { ReportsService } from "./reports.service";

@Controller("reports")
@Roles(...ACCESS["reports.financial"])
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get("financial")
  financialReport(
    @Query(new ZodValidationPipe(financialReportQuerySchema)) query: FinancialReportQuery,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reportsService.financialReport(query, user);
  }

  @Get("financial/csv")
  async financialReportCsv(
    @Query(new ZodValidationPipe(financialReportQuerySchema)) query: FinancialReportQuery,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const csv = await this.reportsService.financialReportCsv(query, user);
    const from = query.from.toISOString().slice(0, 10);
    const to = query.to.toISOString().slice(0, 10);
    res.set({
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="relatorio-financeiro-${from}-${to}.csv"`,
    });
    res.send(csv);
  }
}
