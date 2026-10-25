import type { Env } from "./env.validation";

export function refreshCookieOptions(env: Pick<Env, "COOKIE_SAMESITE" | "COOKIE_SECURE">) {
  return {
    httpOnly: true,
    sameSite: env.COOKIE_SAMESITE as "none" | "lax" | "strict",
    secure: env.COOKIE_SECURE,
  };
}
