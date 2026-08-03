import { Body, Controller, Get, Post, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { loginSchema, type LoginInput } from "@dentist-system/shared-types";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { Public } from "../../common/decorators/public.decorator";
import { CurrentUser, type AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import { AuthService } from "./auth.service";

const REFRESH_COOKIE = "refresh_token";
const REFRESH_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post("login")
  async login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginInput,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, refreshToken } = await this.authService.login(body);
    this.setRefreshCookie(res, refreshToken);
    return { accessToken };
  }

  @Public()
  @Post("refresh")
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.[REFRESH_COOKIE];
    const { accessToken, refreshToken: newRefreshToken } = await this.authService.refresh(refreshToken);
    this.setRefreshCookie(res, newRefreshToken);
    return { accessToken };
  }

  @Post("logout")
  logout(@Res({ passthrough: true }) res: Response) {
    // clearCookie precisa dos MESMOS atributos sameSite/secure usados na criação
    // (ver getRefreshCookieOptions) — um navegador real rejeita silenciosamente um
    // Set-Cookie de limpeza que não declare SameSite=None+Secure pra um cookie
    // cross-site, deixando o cookie original intacto (sessão "sobrevive" ao logout).
    res.clearCookie(REFRESH_COOKIE, this.getRefreshCookieOptions());
    return { success: true };
  }

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
