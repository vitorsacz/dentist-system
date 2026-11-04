import { BadRequestException, Controller, Get, Query, UseGuards } from "@nestjs/common";
import { AllowAuthenticated } from "../../common/decorators/allow-authenticated.decorator";
import { CurrentUser, type AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { AuditAccessGuard } from "./audit-access.guard";
import { AuditService } from "./audit.service";

@Controller("audit")
@AllowAuthenticated()
@UseGuards(AuditAccessGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  // ?userId é alias público para actorId (nomenclatura do schema é interna).
  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query("userId") actorId?: string,
    @Query("action") action?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    const parseDate = (value: string, field: string) => {
      const d = new Date(value);
      if (isNaN(d.getTime())) throw new BadRequestException(`${field} inválido`);
      return d;
    };

    const params = {
      actorId,
      action,
      from: from ? parseDate(from, "from") : undefined,
      to: to ? parseDate(to, "to") : undefined,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    };

    if (user.isSuperAdmin) {
      return this.auditService.listAll(params);
    }

    return this.auditService.list({
      ...params,
      organizationId: user.organizationId as string,
    });
  }
}
