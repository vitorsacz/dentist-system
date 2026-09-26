import request from "supertest";
import { Test } from "@nestjs/testing";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";
import {
  GLOBAL_RATE_LIMIT,
  LOGIN_RATE_LIMIT,
  RATE_LIMIT_MESSAGE,
  REFRESH_RATE_LIMIT,
} from "../src/common/rate-limit/rate-limit.config";

// Rate limit e headers de segurança (S2). Único arquivo da suíte com o rate
// limit ligado (test/env-setup.ts desliga pros demais). Cada teste usa um IP
// de cliente próprio via X-Forwarded-For — com `trust proxy` de 1 salto, é o
// IP que a API considera (como atrás do proxy do Render) — então os contadores
// de um teste não vazam pro outro.

const CORS_ORIGIN = "http://localhost:5173";
let ipCounter = 0;
const nextClientIp = () => `203.0.113.${++ipCounter}`;

describe("Rate limit e headers de segurança", () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    process.env.RATE_LIMIT_DISABLED = "false";
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    process.env.RATE_LIMIT_DISABLED = "true";
    await app.close();
  });

  function loginFrom(ip: string) {
    return request(app.getHttpServer())
      .post("/auth/login")
      .set("X-Forwarded-For", ip)
      .send({ identifier: "ninguem@test.com", password: "SenhaErrada123" });
  }

  it(`a ${LOGIN_RATE_LIMIT + 1}ª tentativa de login no mesmo minuto recebe 429 com mensagem em português`, async () => {
    const ip = nextClientIp();
    for (let attempt = 1; attempt <= LOGIN_RATE_LIMIT; attempt++) {
      expect((await loginFrom(ip)).status).toBe(401);
    }

    const blocked = await loginFrom(ip);
    expect(blocked.status).toBe(429);
    expect(blocked.body.message).toBe(RATE_LIMIT_MESSAGE);
    expect(Number(blocked.headers["retry-after"])).toBeGreaterThan(0);
  });

  it("o limite é por IP do cliente (X-Forwarded-For do proxy), não compartilhado", async () => {
    const blockedIp = nextClientIp();
    for (let attempt = 0; attempt <= LOGIN_RATE_LIMIT; attempt++) {
      await loginFrom(blockedIp);
    }
    expect((await loginFrom(blockedIp)).status).toBe(429);

    // Outro cliente atrás do mesmo proxy continua podendo tentar.
    expect((await loginFrom(nextClientIp())).status).toBe(401);
  });

  it(`refresh tem limite próprio (${REFRESH_RATE_LIMIT}/min)`, async () => {
    const ip = nextClientIp();
    const refresh = () => request(app.getHttpServer()).post("/auth/refresh").set("X-Forwarded-For", ip);
    for (let attempt = 1; attempt <= REFRESH_RATE_LIMIT; attempt++) {
      expect((await refresh()).status).toBe(401);
    }
    expect((await refresh()).status).toBe(429);
  });

  it(`demais rotas usam o limite global (${GLOBAL_RATE_LIMIT}/min)`, async () => {
    const ip = nextClientIp();
    const me = () => request(app.getHttpServer()).get("/auth/me").set("X-Forwarded-For", ip);
    for (let attempt = 1; attempt <= GLOBAL_RATE_LIMIT; attempt++) {
      expect((await me()).status).toBe(401);
    }
    expect((await me()).status).toBe(429);
  });

  it("health check nunca é limitado", async () => {
    const ip = nextClientIp();
    for (let attempt = 0; attempt <= GLOBAL_RATE_LIMIT; attempt++) {
      const res = await request(app.getHttpServer()).get("/health").set("X-Forwarded-For", ip);
      expect(res.status).toBe(200);
    }
  });

  it("respostas trazem os headers do helmet", async () => {
    const res = await request(app.getHttpServer()).get("/health").set("X-Forwarded-For", nextClientIp());
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["strict-transport-security"]).toContain("max-age=");
    expect(res.headers["x-frame-options"]).toBe("SAMEORIGIN");
    expect(res.headers["content-security-policy"]).toContain("default-src 'none'");
    expect(res.headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(res.headers["referrer-policy"]).toBe("no-referrer");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });

  it("CORS com credentials continua funcionando (preflight e resposta)", async () => {
    const preflight = await request(app.getHttpServer())
      .options("/auth/login")
      .set("X-Forwarded-For", nextClientIp())
      .set("Origin", CORS_ORIGIN)
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "content-type");
    expect(preflight.status).toBe(204);
    expect(preflight.headers["access-control-allow-origin"]).toBe(CORS_ORIGIN);
    expect(preflight.headers["access-control-allow-credentials"]).toBe("true");

    const res = await request(app.getHttpServer())
      .get("/health")
      .set("X-Forwarded-For", nextClientIp())
      .set("Origin", CORS_ORIGIN);
    expect(res.headers["access-control-allow-origin"]).toBe(CORS_ORIGIN);
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
  });
});
