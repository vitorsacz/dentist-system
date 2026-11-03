import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import {
  createOrganizationSchema,
  transferFoundingAdminSchema,
  updateOrganizationStatusSchema,
  type CreateOrganizationInput,
  type TransferFoundingAdminInput,
  type UpdateOrganizationStatusInput,
} from "@dentist-system/shared-types";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { AllowAuthenticated } from "../../common/decorators/allow-authenticated.decorator";
import { SuperAdminGuard } from "../../common/guards/super-admin.guard";
import { PlatformService } from "./platform.service";
import { PlatformStatsService } from "./platform-stats.service";

// Super Admin não tem `role` de tenant, então não cabe em @Roles: o
// RolesGuard global só exige autenticação (@AllowAuthenticated) e quem
// restringe de fato ao Super Admin é o SuperAdminGuard.
@Controller("platform")
@AllowAuthenticated()
@UseGuards(SuperAdminGuard)
export class PlatformController {
  constructor(
    private readonly platformService: PlatformService,
    private readonly platformStatsService: PlatformStatsService,
  ) {}

  @Get("stats/overview")
  overview() {
    return this.platformStatsService.overview();
  }

  @Post("organizations")
  create(@Body(new ZodValidationPipe(createOrganizationSchema)) body: CreateOrganizationInput) {
    return this.platformService.createOrganization(body);
  }

  @Get("organizations")
  list() {
    return this.platformService.list();
  }

  @Get("organizations/:id")
  getOrganizationDetail(@Param("id") organizationId: string) {
    return this.platformService.getOrganizationDetail(organizationId);
  }

  // R4: suspender ou reativar organização.
  @Patch("organizations/:id/status")
  updateOrganizationStatus(
    @Param("id") organizationId: string,
    @Body(new ZodValidationPipe(updateOrganizationStatusSchema)) body: UpdateOrganizationStatusInput,
  ) {
    return this.platformService.updateOrganizationStatus(organizationId, body);
  }

  @Patch("organizations/:id/founding-admin")
  transferFoundingAdmin(
    @Param("id") organizationId: string,
    @Body(new ZodValidationPipe(transferFoundingAdminSchema)) body: TransferFoundingAdminInput,
  ) {
    return this.platformService.transferFoundingAdmin(organizationId, body.userId);
  }
}
