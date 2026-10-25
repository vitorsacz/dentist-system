import { z } from "zod";

export const envSchema = z
  .object({
    DATABASE_URL: z.string().min(1),
    DIRECT_URL: z.string().min(1),
    JWT_ACCESS_SECRET: z.string().min(1),
    PORT: z.coerce.number().default(3000),
    CORS_ORIGIN: z.string().default("http://localhost:5173"),
    // Quantos proxies confiáveis ficam na frente da API (Render = 1). Define de
    // onde vem o IP do cliente pro rate limit — ver app.setup.ts.
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(1),
    // Identifica o ambiente para logs e health check. Nenhuma regra de
    // segurança deve depender deste valor.
    APP_ENV: z.enum(["dev", "hml", "prod"]).default("dev"),
    // Política do cookie de refresh. Defaults preservam o comportamento atual
    // de produção (SameSite=None; Secure), que é necessário porque front
    // (Vercel) e API (Render) ficam em origens distintas.
    COOKIE_SAMESITE: z.enum(["none", "lax", "strict"]).default("none"),
    COOKIE_SECURE: z
      .string()
      .default("true")
      .transform((v) => v !== "false" && v !== "0"),
    // SHA do commit injetado no build. "unknown" quando não disponível.
    COMMIT_SHA: z.string().default("unknown"),
  })
  .superRefine((data, ctx) => {
    // Navegadores rejeitam SameSite=None sem Secure (RFC 6265bis).
    if (data.COOKIE_SAMESITE === "none" && !data.COOKIE_SECURE) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["COOKIE_SECURE"],
        message: "COOKIE_SECURE must be true when COOKIE_SAMESITE=none (browsers reject SameSite=None without Secure)",
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const isProd = config.NODE_ENV === "production";
  return envSchema.parse({
    COOKIE_SAMESITE: config.COOKIE_SAMESITE ?? (isProd ? "none" : "lax"),
    COOKIE_SECURE: config.COOKIE_SECURE ?? (isProd ? "true" : "false"),
    ...config,
    COMMIT_SHA: config.COMMIT_SHA ?? config.RENDER_GIT_COMMIT ?? "unknown",
  });
}
