import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import {
  createOrganizationSchema,
  transferFoundingAdminSchema,
  type CreateOrganizationInput,
  type TransferFoundingAdminInput,
} from "@dentist-system/shared-types";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { SuperAdminGuard } from "../../common/guards/super-admin.guard";
import { PlatformService } from "./platform.service";

@Controller("platform")
@UseGuards(SuperAdminGuard)
export class PlatformController {
  constructor(private readonly platformService: PlatformService) {}

  @Post("organizations")
  create(@Body(new ZodValidationPipe(createOrganizationSchema)) body: CreateOrganizationInput) {
    return this.platformService.createOrganization(body);
  }

  @Get("organizations")
  list() {
    return this.platformService.list();
  }

  @Patch("organizations/:id/founding-admin")
  transferFoundingAdmin(
    @Param("id") organizationId: string,
    @Body(new ZodValidationPipe(transferFoundingAdminSchema)) body: TransferFoundingAdminInput,
  ) {
    return this.platformService.transferFoundingAdmin(organizationId, body.userId);
  }
}
