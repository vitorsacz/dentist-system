import { refreshCookieOptions } from "../src/config/cookie-policy";
import { validateEnv } from "../src/config/env.validation";

describe("refreshCookieOptions", () => {
  it("none + secure=true → SameSite=None; Secure (cross-site production)", () => {
    const opts = refreshCookieOptions({ COOKIE_SAMESITE: "none", COOKIE_SECURE: true });
    expect(opts).toEqual({ httpOnly: true, sameSite: "none", secure: true });
  });

  it("lax + secure=false → SameSite=Lax sem Secure (dev local http)", () => {
    const opts = refreshCookieOptions({ COOKIE_SAMESITE: "lax", COOKIE_SECURE: false });
    expect(opts).toEqual({ httpOnly: true, sameSite: "lax", secure: false });
  });

  it("strict + secure=true → SameSite=Strict; Secure", () => {
    const opts = refreshCookieOptions({ COOKIE_SAMESITE: "strict", COOKIE_SECURE: true });
    expect(opts).toEqual({ httpOnly: true, sameSite: "strict", secure: true });
  });
});

describe("validateEnv — validação COOKIE_SAMESITE + COOKIE_SECURE", () => {
  const base = {
    DATABASE_URL: "postgresql://x:x@localhost:5432/db",
    DIRECT_URL: "postgresql://x:x@localhost:5432/db",
    JWT_ACCESS_SECRET: "secret",
  };

  it("none + COOKIE_SECURE=false falha no boot (browsers rejeitam)", () => {
    expect(() =>
      validateEnv({ ...base, COOKIE_SAMESITE: "none", COOKIE_SECURE: "false" }),
    ).toThrow(/COOKIE_SECURE must be true when COOKIE_SAMESITE=none/);
  });

  it("none + COOKIE_SECURE=true é válido", () => {
    expect(() =>
      validateEnv({ ...base, COOKIE_SAMESITE: "none", COOKIE_SECURE: "true" }),
    ).not.toThrow();
  });

  it("lax + COOKIE_SECURE=false é válido (dev local)", () => {
    expect(() =>
      validateEnv({ ...base, COOKIE_SAMESITE: "lax", COOKIE_SECURE: "false" }),
    ).not.toThrow();
  });

  it("NODE_ENV=production sem variáveis → none + Secure=true", () => {
    const env = validateEnv({ ...base, NODE_ENV: "production" });
    expect(env.COOKIE_SAMESITE).toBe("none");
    expect(env.COOKIE_SECURE).toBe(true);
  });

  it("NODE_ENV=development sem variáveis → lax + Secure=false", () => {
    const env = validateEnv({ ...base, NODE_ENV: "development" });
    expect(env.COOKIE_SAMESITE).toBe("lax");
    expect(env.COOKIE_SECURE).toBe(false);
  });

  it("override explícito tem prioridade sobre NODE_ENV", () => {
    const env = validateEnv({ ...base, NODE_ENV: "production", COOKIE_SAMESITE: "strict", COOKIE_SECURE: "false" });
    expect(env.COOKIE_SAMESITE).toBe("strict");
    expect(env.COOKIE_SECURE).toBe(false);
  });
});

describe("validateEnv — COMMIT_SHA fallback", () => {
  const base = {
    DATABASE_URL: "postgresql://x:x@localhost:5432/db",
    DIRECT_URL: "postgresql://x:x@localhost:5432/db",
    JWT_ACCESS_SECRET: "secret",
  };

  it("COMMIT_SHA explícito tem prioridade sobre RENDER_GIT_COMMIT", () => {
    const env = validateEnv({ ...base, COMMIT_SHA: "abc123", RENDER_GIT_COMMIT: "ignored" });
    expect(env.COMMIT_SHA).toBe("abc123");
  });

  it("cai para RENDER_GIT_COMMIT quando COMMIT_SHA não definido", () => {
    const env = validateEnv({ ...base, RENDER_GIT_COMMIT: "render456" });
    expect(env.COMMIT_SHA).toBe("render456");
  });

  it("'unknown' quando nenhum está definido", () => {
    const env = validateEnv({ ...base });
    expect(env.COMMIT_SHA).toBe("unknown");
  });
});
