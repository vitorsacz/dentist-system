import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res } from "@nestjs/common";
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
import { AuthService } from "./auth.service";

const REFRESH_COOKIE = "refresh_token";
const REFRESH_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

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
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResult> {
    const outcome = await this.authService.login(body);
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
    const { accessToken, refreshToken: newRefreshToken } = await this.authService.refresh(refreshToken);
    this.setRefreshCookie(res, newRefreshToken);
    return { accessToken };
  }

  @AllowAuthenticated()
  @Post("logout")
  logout(@Res({ passthrough: true }) res: Response) {
    // clearCookie precisa dos MESMOS atributos sameSite/secure usados na criação
    // (ver getRefreshCookieOptions) — um navegador real rejeita silenciosamente um
    // Set-Cookie de limpeza que não declare SameSite=None+Secure pra um cookie
    // cross-site, deixando o cookie original intacto (sessão "sobrevive" ao logout).
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
      maxAge: REFRESH_COOKIE_MAX_AGE_MS,
    });
  }
}
