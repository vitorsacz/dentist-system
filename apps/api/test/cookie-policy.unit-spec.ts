import { refreshCookieOptions } from "../src/config/cookie-policy";
import { validateEnv } from "../src/config/env.validation";
import { chooseSeed } from "../prisma/seed-dispatch";

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

  it("defaults preservam comportamento de produção (none + true)", () => {
    const env = validateEnv({ ...base });
    expect(env.COOKIE_SAMESITE).toBe("none");
    expect(env.COOKIE_SECURE).toBe(true);
  });
});

describe("chooseSeed", () => {
  it("APP_ENV=prod → bootstrap (nunca bloqueia seed legítimo)", () => {
    expect(chooseSeed("prod")).toBe("bootstrap");
  });

  it("APP_ENV=dev → bootstrap", () => {
    expect(chooseSeed("dev")).toBe("bootstrap");
  });

  it("APP_ENV=hml → hml (personas fictícias)", () => {
    expect(chooseSeed("hml")).toBe("hml");
  });
});
