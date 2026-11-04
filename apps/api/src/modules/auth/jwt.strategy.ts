import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import type { Role } from "@dentist-system/shared-types";
import { PRISMA_SERVICE, type PrismaService } from "../../prisma/prisma.service";

interface JwtPayload {
  sub: string;
  email: string;
  organizationId: string | null;
  roles: Role[];
  isSuperAdmin: boolean;
  // change-password tokens carry kind; real access tokens never do.
  kind?: string;
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

  // Relê o usuário do banco a cada request: papéis, ativo, organização e
  // mustChangePassword valem sempre o estado atual, não o que estava no token.
  // changeTokens (kind="must-change-password") são JWT válidos mas não são
  // access tokens: rejeitados aqui para que só sirvam ao endpoint dedicado.
  async validate(payload: JwtPayload) {
    if (payload.kind === "must-change-password") {
      throw new UnauthorizedException("Token de troca de senha não é válido para autenticação");
    }
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { organization: { select: { status: true } } },
    });
    if (!user || !user.active) {
      throw new UnauthorizedException();
    }
    // R4: organização suspensa bloqueia todos os seus usuários imediatamente.
    if (user.organization?.status === "SUSPENDED") {
      throw new UnauthorizedException("Organização suspensa. Contate o administrador da plataforma.");
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      organizationId: user.organizationId,
      roles: user.roles,
      isSuperAdmin: user.isSuperAdmin,
      mustChangePassword: user.mustChangePassword,
    };
  }
}
