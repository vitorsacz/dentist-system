import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import type { Role } from "@dentist-system/shared-types";
import { PRISMA_SERVICE, type PrismaService } from "../../prisma/prisma.service";

interface JwtPayload {
  sub: string;
  email: string;
  organizationId: string;
  membershipId: string;
  role: Role;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    @Inject(PRISMA_SERVICE) private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: configService.getOrThrow<string>("JWT_ACCESS_SECRET"),
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true, active: true },
    });
    if (!user || !user.active) {
      throw new UnauthorizedException();
    }

    // Re-checado a cada request (mesmo padrão do `user.active` acima):
    // desativar uma membership ou trocar seu papel vale na próxima request,
    // não só depois do access token expirar (15min).
    const membership = await this.prisma.membership.findUnique({ where: { id: payload.membershipId } });
    if (!membership || membership.userId !== user.id || !membership.active) {
      throw new UnauthorizedException();
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      organizationId: membership.organizationId,
      membershipId: membership.id,
      role: membership.role,
    };
  }
}
