import { BadRequestException, Controller, Get } from "@nestjs/common";
import { AllowAuthenticated } from "../../common/decorators/allow-authenticated.decorator";
import { CurrentUser, type AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { ACCESS } from "@dentist-system/shared-types";
import { Roles } from "../../common/decorators/roles.decorator";
import { OrganizationService } from "./organization.service";

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

  // Deliberadamente mais restrito que getMine() — ver
  // OrganizationService.findDentists().
  @Roles(...ACCESS["organization.dentists"])
  @Get("dentists")
  getDentists(@CurrentUser() user: AuthenticatedUser) {
    if (!user.organizationId) {
      throw new BadRequestException("Super Admin não pertence a nenhuma organização");
    }
    return this.organizationService.findDentists(user.organizationId);
  }
}
