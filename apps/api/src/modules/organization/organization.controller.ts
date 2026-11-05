import { BadRequestException, Body, Controller, Get, HttpCode, Patch, Query } from "@nestjs/common";
import { AllowAuthenticated } from "../../common/decorators/allow-authenticated.decorator";
import { CurrentUser, type AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { ACCESS, updateOrganizationProfileSchema, type UpdateOrganizationProfileInput } from "@dentist-system/shared-types";
import { Roles } from "../../common/decorators/roles.decorator";
import { OrganizationService } from "./organization.service";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";

@Controller("organization")
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  // Qualquer papel da organização vê "Minha Clínica" (nome + membros).
  @AllowAuthenticated()
  @Get()
  getMine(@CurrentUser() user: AuthenticatedUser) {
    if (!user.organizationId) {
      throw new BadRequestException("Super Admin não pertence a nenhuma organização");
    }
    return this.organizationService.findMine(user.organizationId);
  }

  @Roles(...ACCESS["organization.write"])
  @Patch()
  @HttpCode(204)
  updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(updateOrganizationProfileSchema)) body: UpdateOrganizationProfileInput,
  ) {
    if (!user.organizationId) {
      throw new BadRequestException("Super Admin não pertence a nenhuma organização");
    }
    return this.organizationService.update(user.organizationId, body);
  }

  // Deliberadamente mais restrito que getMine() — ver
  // OrganizationService.findDentists().
  @Roles(...ACCESS["organization.dentists"])
  @Get("dentists")
  getDentists(
    @CurrentUser() user: AuthenticatedUser,
    @Query("includeInactive") includeInactive?: string,
  ) {
    if (!user.organizationId) {
      throw new BadRequestException("Super Admin não pertence a nenhuma organização");
    }
    return this.organizationService.findDentists(user.organizationId, includeInactive === "true");
  }
}
