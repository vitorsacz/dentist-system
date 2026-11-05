import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { PRISMA_SERVICE, type PrismaService } from "../../prisma/prisma.service";
import type { AuthenticatedUser } from "../../common/decorators/current-user.decorator";

// Leitura de auditoria permitida para:
// 1. Super Admin (vê todos os tenants)
// 2. ADMIN da organização
// 3. Fundador (foundingAdminUserId) de organização FREELANCER
//    (o dentista que cadastrou o próprio consultório)
@Injectable()
export class AuditAccessGuard implements CanActivate {
  constructor(@Inject(PRISMA_SERVICE) private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const user = req.user as AuthenticatedUser | undefined;

    if (!user) throw new ForbiddenException();
    if (user.isSuperAdmin) return true;
    if (!user.organizationId) throw new ForbiddenException();
    if (user.roles.includes("ADMIN")) return true;

    // Verifica se é fundador de organização FREELANCER
    const org = await this.prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: { type: true, foundingAdminUserId: true },
    });

    if (org?.type === "FREELANCER" && org.foundingAdminUserId === user.id) {
      return true;
    }

    throw new ForbiddenException("Acesso à auditoria negado");
  }
}
