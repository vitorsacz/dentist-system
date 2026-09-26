import { createHash } from "node:crypto";
import request from "supertest";
import { Test } from "@nestjs/testing";
import type { NestExpressApplication } from "@nestjs/platform-express";
import * as bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";
import { TEST_DATABASE_URL } from "./test-db";

// Refresh token revogável com rotação (S3). Cada login num "navegador" abre
// uma família de sessões; o refresh troca o token a cada uso; reuso de um
// token já trocado derruba a família; logout revoga a família; logout-all e
// desativação revogam tudo do usuário.

const rawPrisma = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } });
const PASSWORD = "SenhaForte12345";
const REFRESH_COOKIE = "refresh_token";

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

function refreshCookieFrom(res: request.Response): string | undefined {
  const cookies = ([] as string[]).concat(res.headers["set-cookie"] ?? []);
  const cookie = cookies.find((c) => c.startsWith(`${REFRESH_COOKIE}=`));
  const value = cookie?.split(";")[0]?.slice(REFRESH_COOKIE.length + 1);
  return value ? decodeURIComponent(value) : undefined;
}

describe("Sessões de refresh revogáveis", () => {
  let app: NestExpressApplication;
  let organizationId: string;
  let adminToken: string;

  const server = () => app.getHttpServer();

  async function createUser(role: "ADMIN" | "DENTIST" = "DENTIST") {
    const email = `sessao-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`;
    const user = await rawPrisma.user.create({
      data: { organizationId, email, passwordHash: await bcrypt.hash(PASSWORD, 10), name: email, roles: [role] },
    });
    return { id: user.id, email };
  }

  // Um "navegador": faz login e guarda access token + cookie de refresh.
  async function loginBrowser(email: string) {
    const res = await request(server()).post("/auth/login").send({ identifier: email, password: PASSWORD });
    expect(res.status).toBe(200);
    const refreshToken = refreshCookieFrom(res);
    expect(refreshToken).toBeTruthy();
    return { accessToken: res.body.accessToken as string, refreshToken: refreshToken as string };
  }

  function refresh(token: string) {
    return request(server()).post("/auth/refresh").set("Cookie", `${REFRESH_COOKIE}=${encodeURIComponent(token)}`);
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.init();

    await rawPrisma.organization.deleteMany({});
    await rawPrisma.user.deleteMany({});
    const org = await rawPrisma.organization.create({ data: { name: "Clínica (teste sessões)" } });
    organizationId = org.id;
    const admin = await createUser("ADMIN");
    await rawPrisma.organization.update({ where: { id: org.id }, data: { foundingAdminUserId: admin.id } });
    adminToken = (await loginBrowser(admin.email)).accessToken;
  }, 30000);

  afterAll(async () => {
    await rawPrisma.organization.deleteMany({});
    await rawPrisma.user.deleteMany({});
    await rawPrisma.$disconnect();
    await app.close();
  });

  it("refresh token é opaco (não é JWT) e o banco guarda só o hash SHA-256", async () => {
    const user = await createUser();
    const { refreshToken } = await loginBrowser(user.email);

    expect(refreshToken.split(".")).toHaveLength(1);
    const sessions = await rawPrisma.refreshSession.findMany({ where: { userId: user.id } });
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.tokenHash).toBe(sha256(refreshToken));
    expect(sessions[0]?.tokenHash).not.toBe(refreshToken);
  });

  it("refresh rotaciona: devolve access token e cookie novos, na mesma família", async () => {
    const user = await createUser();
    const { refreshToken } = await loginBrowser(user.email);

    const res = await refresh(refreshToken);
    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeTruthy();
    const rotated = refreshCookieFrom(res);
    expect(rotated).toBeTruthy();
    expect(rotated).not.toBe(refreshToken);

    const old = await rawPrisma.refreshSession.findUnique({ where: { tokenHash: sha256(refreshToken) } });
    const next = await rawPrisma.refreshSession.findUnique({ where: { tokenHash: sha256(rotated as string) } });
    expect(old?.revokedAt).toBeTruthy();
    expect(old?.replacedById).toBe(next?.id);
    expect(next?.familyId).toBe(old?.familyId);
    expect(next?.revokedAt).toBeNull();

    // O token novo segue funcionando.
    expect((await refresh(rotated as string)).status).toBe(201);
  });

  it("token antigo reutilizado depois de uma rotação é rejeitado e derruba a família inteira", async () => {
    const user = await createUser();
    const { refreshToken: original } = await loginBrowser(user.email);
    const rotated = refreshCookieFrom(await refresh(original)) as string;

    const reuse = await refresh(original);
    expect(reuse.status).toBe(401);

    // O token legítimo mais novo também morreu: a família inteira foi revogada.
    expect((await refresh(rotated)).status).toBe(401);
    const active = await rawPrisma.refreshSession.count({ where: { userId: user.id, revokedAt: null } });
    expect(active).toBe(0);
  });

  it("reuso numa família não derruba a sessão de outro navegador do mesmo usuário", async () => {
    const user = await createUser();
    const browserA = await loginBrowser(user.email);
    const browserB = await loginBrowser(user.email);

    await refresh(browserA.refreshToken);
    expect((await refresh(browserA.refreshToken)).status).toBe(401);

    expect((await refresh(browserB.refreshToken)).status).toBe(201);
  });

  // Duas abas sem coordenação mandando o mesmo token ao mesmo tempo: uma
  // rotaciona, a outra é tratada como reuso — nunca as duas, nunca erro 500
  // (transação interativa disputando a linha dava P2028 no Prisma 5.22).
  it("dois refresh simultâneos com o mesmo token: exatamente um vence, o outro é 401", async () => {
    const user = await createUser();
    for (let round = 0; round < 5; round++) {
      const { refreshToken } = await loginBrowser(user.email);
      const statuses = (await Promise.all([refresh(refreshToken), refresh(refreshToken)])).map((r) => r.status);
      expect(statuses.sort()).toEqual([201, 401]);
    }
  });

  it("token usado depois do logout é rejeitado", async () => {
    const user = await createUser();
    const { accessToken, refreshToken } = await loginBrowser(user.email);

    const logout = await request(server())
      .post("/auth/logout")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Cookie", `${REFRESH_COOKIE}=${encodeURIComponent(refreshToken)}`);
    expect(logout.status).toBe(201);

    expect((await refresh(refreshToken)).status).toBe(401);
  });

  it("logout de um usuário não revoga a sessão de outro, mesmo mandando o cookie dele", async () => {
    const victim = await createUser();
    const attacker = await createUser();
    const victimSession = await loginBrowser(victim.email);
    const attackerSession = await loginBrowser(attacker.email);

    await request(server())
      .post("/auth/logout")
      .set("Authorization", `Bearer ${attackerSession.accessToken}`)
      .set("Cookie", `${REFRESH_COOKIE}=${encodeURIComponent(victimSession.refreshToken)}`);

    expect((await refresh(victimSession.refreshToken)).status).toBe(201);
  });

  it('"sair de todos os dispositivos" invalida as sessões de outros navegadores', async () => {
    const user = await createUser();
    const browserA = await loginBrowser(user.email);
    const browserB = await loginBrowser(user.email);
    const browserC = await loginBrowser(user.email);

    const res = await request(server())
      .post("/auth/logout-all")
      .set("Authorization", `Bearer ${browserA.accessToken}`)
      .set("Cookie", `${REFRESH_COOKIE}=${encodeURIComponent(browserA.refreshToken)}`);
    expect(res.status).toBe(201);

    expect((await refresh(browserA.refreshToken)).status).toBe(401);
    expect((await refresh(browserB.refreshToken)).status).toBe(401);
    expect((await refresh(browserC.refreshToken)).status).toBe(401);
  });

  it("desativar um usuário revoga todas as sessões dele", async () => {
    const user = await createUser();
    const browserA = await loginBrowser(user.email);
    const browserB = await loginBrowser(user.email);

    const deactivate = await request(server())
      .patch(`/users/${user.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ active: false });
    expect(deactivate.status).toBe(200);

    expect((await refresh(browserA.refreshToken)).status).toBe(401);
    expect((await refresh(browserB.refreshToken)).status).toBe(401);
    expect(await rawPrisma.refreshSession.count({ where: { userId: user.id, revokedAt: null } })).toBe(0);
  });

  it("token expirado, desconhecido ou ausente: 401", async () => {
    const user = await createUser();
    const { refreshToken } = await loginBrowser(user.email);
    await rawPrisma.refreshSession.update({
      where: { tokenHash: sha256(refreshToken) },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    expect((await refresh(refreshToken)).status).toBe(401);
    expect((await refresh("token-que-nunca-existiu")).status).toBe(401);
    expect((await request(server()).post("/auth/refresh")).status).toBe(401);
  });

  it("refresh rejeitado apaga o cookie do navegador", async () => {
    const res = await refresh("token-que-nunca-existiu");
    expect(res.status).toBe(401);
    const cookies = ([] as string[]).concat(res.headers["set-cookie"] ?? []);
    expect(cookies.some((c) => c.startsWith(`${REFRESH_COOKIE}=;`))).toBe(true);
  });
});
