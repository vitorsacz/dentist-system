import { Controller, Get } from "@nestjs/common";
import { CurrentUser, type AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { OrganizationService } from "./organization.service";

@Controller("organization")
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Get()
  getMine(@CurrentUser() user: AuthenticatedUser) {
    return this.organizationService.findMine(user.organizationId);
  }
}
