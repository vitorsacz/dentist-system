import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res, UnauthorizedException } from "@nestjs/common";
import type { Request, Response } from "express";
import { Throttle } from "@nestjs/throttler";
import { loginSchema, type LoginInput, type LoginResult } from "@dentist-system/shared-types";
import {
  LOGIN_RATE_LIMIT,
  RATE_LIMIT_WINDOW_MS,
  REFRESH_RATE_LIMIT,
} from "../../common/rate-limit/rate-limit.config";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { Public } from "../../common/decorators/public.decorator";
import { AllowAuthenticated } from "../../common/decorators/allow-authenticated.decorator";
import { CurrentUser, type AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { REFRESH_SESSION_TTL_MS, type SessionClientInfo } from "../sessions/refresh-sessions.service";
import { AuthService } from "./auth.service";

const REFRESH_COOKIE = "refresh_token";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Único ponto público que recebe um identifier. Não existe mais rota que
  // diga se um e-mail existe ou em quais organizações está (o antigo
  // POST auth/lookup foi removido): a lista de organizações só aparece depois
  // da senha conferir, e só com as organizações em que ela conferiu.
  @Public()
  @Throttle({ default: { limit: LOGIN_RATE_LIMIT, ttl: RATE_LIMIT_WINDOW_MS } })
  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResult> {
    const outcome = await this.authService.login(body, clientInfo(req));
    if (outcome.kind === "organization-selection") {
      return { requiresOrganizationSelection: true, accounts: outcome.accounts };
    }
    this.setRefreshCookie(res, outcome.refreshToken);
    return { accessToken: outcome.accessToken };
  }

  @Public()
  @Throttle({ default: { limit: REFRESH_RATE_LIMIT, ttl: RATE_LIMIT_WINDOW_MS } })
  @Post("refresh")
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.[REFRESH_COOKIE];
    try {
      const { accessToken, refreshToken: newRefreshToken } = await this.authService.refresh(
        refreshToken,
        clientInfo(req),
      );
      this.setRefreshCookie(res, newRefreshToken);
      return { accessToken };
    } catch (error) {
      // Token inválido/revogado/expirado: apaga o cookie pra o navegador não
      // ficar reenviando um token morto. Erro de outro tipo (ex.: banco fora
      // do ar) não apaga — a sessão pode seguir válida.
      if (refreshToken && error instanceof UnauthorizedException) {
        res.clearCookie(REFRESH_COOKIE, this.getRefreshCookieOptions());
      }
      throw error;
    }
  }

  // Revoga no servidor a família da sessão deste navegador (o token deixa de
  // valer mesmo que alguém tenha copiado o cookie) e apaga o cookie.
  @AllowAuthenticated()
  @Post("logout")
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logout(req.cookies?.[REFRESH_COOKIE], user.id);
    // clearCookie precisa dos MESMOS atributos sameSite/secure usados na criação
    // (ver getRefreshCookieOptions) — um navegador real rejeita silenciosamente um
    // Set-Cookie de limpeza que não declare SameSite=None+Secure pra um cookie
    // cross-site, deixando o cookie original intacto (sessão "sobrevive" ao logout).
    res.clearCookie(REFRESH_COOKIE, this.getRefreshCookieOptions());
    return { success: true };
  }

  // "Sair de todos os dispositivos": revoga todas as sessões do usuário, em
  // qualquer navegador. Access tokens já emitidos seguem válidos até expirar
  // (15 min) — o refresh deles é que para de funcionar.
  @AllowAuthenticated()
  @Post("logout-all")
  async logoutEverywhere(@CurrentUser() user: AuthenticatedUser, @Res({ passthrough: true }) res: Response) {
    await this.authService.logoutEverywhere(user.id);
    res.clearCookie(REFRESH_COOKIE, this.getRefreshCookieOptions());
    return { success: true };
  }

  @AllowAuthenticated()
  @Get("me")
  me(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }

  private getRefreshCookieOptions() {
    // Vercel (front) e Render (back) são domínios diferentes: cookie precisa de
    // SameSite=None (+ Secure) pra ser enviado em fetch cross-site com credentials:"include".
    // Em dev local (http://localhost) Secure quebraria o cookie, por isso o fallback abaixo.
    const isProd = process.env.NODE_ENV === "production";
    return {
      httpOnly: true,
      sameSite: (isProd ? "none" : "lax") as "none" | "lax",
      secure: isProd,
    };
  }

  private setRefreshCookie(res: Response, refreshToken: string) {
    res.cookie(REFRESH_COOKIE, refreshToken, {
      ...this.getRefreshCookieOptions(),
      maxAge: REFRESH_SESSION_TTL_MS,
    });
  }
}

function clientInfo(req: Request): SessionClientInfo {
  return { userAgent: req.headers["user-agent"], ip: req.ip };
}
