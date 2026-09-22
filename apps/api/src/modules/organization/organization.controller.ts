import { BadRequestException, Controller, Get } from "@nestjs/common";
import { CurrentUser, type AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { OrganizationService } from "./organization.service";

@Controller("organization")
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Get()
  getMine(@CurrentUser() user: AuthenticatedUser) {
    if (!user.organizationId) {
      throw new BadRequestException("Super Admin não pertence a nenhuma organização");
    }
    return this.organizationService.findMine(user.organizationId);
  }

  // Sobrepõe a ausência de @Roles da classe (permissiva) — este endpoint é
  // deliberadamente mais restrito, ver OrganizationService.findDentists().
  @Roles("ADMIN", "RECEPTIONIST")
  @Get("dentists")
  getDentists(@CurrentUser() user: AuthenticatedUser) {
    if (!user.organizationId) {
      throw new BadRequestException("Super Admin não pertence a nenhuma organização");
    }
    return this.organizationService.findDentists(user.organizationId);
  }
}
