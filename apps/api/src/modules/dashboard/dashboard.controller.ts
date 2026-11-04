import { Controller, Get } from "@nestjs/common";
import { ACCESS } from "@dentist-system/shared-types";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser, type AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { DashboardService } from "./dashboard.service";

@Controller("dashboard")
@Roles(...ACCESS["dashboard.view"])
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get("overview")
  overview(@CurrentUser() actor: AuthenticatedUser) {
    return this.dashboardService.overview(actor);
  }
}
