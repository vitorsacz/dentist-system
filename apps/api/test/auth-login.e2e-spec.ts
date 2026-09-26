import request from "supertest";
import { Test } from "@nestjs/testing";
import type { NestExpressApplication } from "@nestjs/platform-express";
import * as bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";
import { TEST_DATABASE_URL } from "./test-db";

// Login sem vazamento de organizações (S1). Identidade é isolada por
// organização: o mesmo e-mail pode ter conta em várias, com senhas
// diferentes. Nenhuma rota pública pode revelar se um identifier existe nem
// em quais organizações ele está — a lista de organizações só aparece depois
// da senha conferir, e só com as organizações em que ela conferiu.

const rawPrisma = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } });
const PASSWORD_A = "SenhaDaOrgA123";
const PASSWORD_B = "SenhaDaOrgB456";

describe("Login sem vazamento de organizações", () => {
  let app: NestExpressApplication;
  let orgA: { id: string; name: string };
  let orgB: { id: string; name: string };
  let orgC: { id: string; name: string };

  const unique = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  function login(body: Record<string, unknown>) {
    return request(app.getHttpServer()).post("/auth/login").send(body);
  }

  async function createAccount(organizationId: string, email: string, password: string, nickname?: string) {
    return rawPrisma.user.create({
      data: {
        organizationId,
        email,
        nickname,
        passwordHash: await bcrypt.hash(password, 10),
        name: `Pessoa ${email}`,
        role: "DENTIST",
      },
    });
  }

  async function organizationOf(accessToken: string) {
    const me = await request(app.getHttpServer()).get("/auth/me").set("Authorization", `Bearer ${accessToken}`);
    expect(me.status).toBe(200);
    return me.body.organizationId as string;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.init();

    await rawPrisma.organization.deleteMany({});
    await rawPrisma.user.deleteMany({});
    orgA = await rawPrisma.organization.create({ data: { name: "Clínica A (teste login)" } });
    orgB = await rawPrisma.organization.create({ data: { name: "Clínica B (teste login)" } });
    orgC = await rawPrisma.organization.create({ data: { name: "Clínica C (teste login)" } });
  }, 30000);

  afterAll(async () => {
    await rawPrisma.organization.deleteMany({});
    await rawPrisma.user.deleteMany({});
    await rawPrisma.$disconnect();
    await app.close();
  });

  it("POST /auth/lookup não existe mais", async () => {
    const res = await request(app.getHttpServer()).post("/auth/lookup").send({ identifier: "qualquer@test.com" });
    expect(res.status).toBe(404);
  });

  it("e-mail inexistente e senha errada devolvem exatamente a mesma resposta 401", async () => {
    const email = `existe-${unique()}@test.com`;
    await createAccount(orgA.id, email, PASSWORD_A);

    const unknownEmail = await login({ identifier: `nao-existe-${unique()}@test.com`, password: PASSWORD_A });
    const wrongPassword = await login({ identifier: email, password: "SenhaErrada999" });

    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.status).toBe(401);
    expect(wrongPassword.body).toEqual(unknownEmail.body);
    expect(unknownEmail.headers["set-cookie"]).toBeUndefined();
    expect(wrongPassword.headers["set-cookie"]).toBeUndefined();
  });

  it("senha errada numa conta com e-mail em várias organizações não revela nenhuma delas", async () => {
    const email = `multi-errada-${unique()}@test.com`;
    await createAccount(orgA.id, email, PASSWORD_A);
    await createAccount(orgB.id, email, PASSWORD_A);

    const res = await login({ identifier: email, password: "SenhaErrada999" });
    expect(res.status).toBe(401);
    expect(JSON.stringify(res.body)).not.toContain("Clínica");
    expect(res.body.accounts).toBeUndefined();
  });

  it("mesma senha em 2 organizações: devolve a lista das duas, sem tokens", async () => {
    const email = `mesma-senha-${unique()}@test.com`;
    await createAccount(orgA.id, email, PASSWORD_A);
    await createAccount(orgB.id, email, PASSWORD_A);

    const res = await login({ identifier: email, password: PASSWORD_A });
    expect(res.status).toBe(200);
    expect(res.body.requiresOrganizationSelection).toBe(true);
    expect(res.body.accessToken).toBeUndefined();
    expect(res.headers["set-cookie"]).toBeUndefined();
    expect(res.body.accounts).toHaveLength(2);
    expect(res.body.accounts).toEqual(
      expect.arrayContaining([
        { organizationId: orgA.id, organizationName: orgA.name },
        { organizationId: orgB.id, organizationName: orgB.name },
      ]),
    );
  });

  it("reenvio com organizationId entra na organização escolhida e valida a senha de novo", async () => {
    const email = `escolha-${unique()}@test.com`;
    await createAccount(orgA.id, email, PASSWORD_A);
    await createAccount(orgB.id, email, PASSWORD_A);

    const chosen = await login({ identifier: email, password: PASSWORD_A, organizationId: orgB.id });
    expect(chosen.status).toBe(200);
    expect(chosen.body.accessToken).toBeTruthy();
    expect(chosen.headers["set-cookie"]?.[0]).toContain("refresh_token=");
    expect(await organizationOf(chosen.body.accessToken)).toBe(orgB.id);

    const wrongPassword = await login({ identifier: email, password: "SenhaErrada999", organizationId: orgB.id });
    expect(wrongPassword.status).toBe(401);

    // Organização em que o e-mail não tem conta: mesma resposta genérica.
    const otherOrg = await login({ identifier: email, password: PASSWORD_A, organizationId: orgC.id });
    expect(otherOrg.status).toBe(401);
    expect(otherOrg.body).toEqual(wrongPassword.body);
  });

  it("senhas diferentes: senha válida só numa organização entra direto nela, sem revelar a outra", async () => {
    const email = `senhas-diferentes-${unique()}@test.com`;
    await createAccount(orgA.id, email, PASSWORD_A);
    await createAccount(orgB.id, email, PASSWORD_B);

    const intoA = await login({ identifier: email, password: PASSWORD_A });
    expect(intoA.status).toBe(200);
    expect(intoA.body.requiresOrganizationSelection).toBeUndefined();
    expect(await organizationOf(intoA.body.accessToken)).toBe(orgA.id);

    const intoB = await login({ identifier: email, password: PASSWORD_B });
    expect(intoB.status).toBe(200);
    expect(await organizationOf(intoB.body.accessToken)).toBe(orgB.id);
  });

  it("lista só as organizações em que a senha conferiu", async () => {
    const email = `parcial-${unique()}@test.com`;
    await createAccount(orgA.id, email, PASSWORD_A);
    await createAccount(orgB.id, email, PASSWORD_A);
    await createAccount(orgC.id, email, PASSWORD_B);

    const res = await login({ identifier: email, password: PASSWORD_A });
    expect(res.status).toBe(200);
    expect(res.body.requiresOrganizationSelection).toBe(true);
    const listed = (res.body.accounts as { organizationId: string }[]).map((a) => a.organizationId).sort();
    expect(listed).toEqual([orgA.id, orgB.id].sort());
  });

  it("conta desativada não entra nem aparece na lista", async () => {
    const email = `desativada-${unique()}@test.com`;
    await createAccount(orgA.id, email, PASSWORD_A);
    const inactive = await createAccount(orgB.id, email, PASSWORD_A);
    await rawPrisma.user.update({ where: { id: inactive.id }, data: { active: false } });

    const res = await login({ identifier: email, password: PASSWORD_A });
    expect(res.status).toBe(200);
    expect(res.body.requiresOrganizationSelection).toBeUndefined();
    expect(await organizationOf(res.body.accessToken)).toBe(orgA.id);
  });

  it("login por nickname (único globalmente) entra direto", async () => {
    const nickname = `apelido-${unique()}`;
    const email = `com-apelido-${unique()}@test.com`;
    await createAccount(orgA.id, email, PASSWORD_A, nickname);
    await createAccount(orgB.id, email, PASSWORD_A);

    const res = await login({ identifier: nickname, password: PASSWORD_A });
    expect(res.status).toBe(200);
    expect(await organizationOf(res.body.accessToken)).toBe(orgA.id);
  });
});
