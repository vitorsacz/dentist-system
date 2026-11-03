import request from "supertest";
import { Test } from "@nestjs/testing";
import type { NestExpressApplication } from "@nestjs/platform-express";
import * as bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";
import { TEST_DATABASE_URL } from "./test-db";
import { teardownAll } from "./helpers/teardown";

// Personas:
//   ADMIN        — ADMIN role, Org A. Pode ler, criar, editar e soft-delete.
//   DENTIST      — DENTIST role, Org A. Só lê.
//   RECEPTIONIST — RECEPTIONIST role, Org A. Só lê.
//   FREELANCER   — ADMIN+DENTIST roles (simula dentista autônomo), Org A. Pode ler e escrever.
//   ADMIN2       — ADMIN role, Org B. Não enxerga dados da Org A (isolamento).

const rawPrisma = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } });
const TEST_PASSWORD = "SenhaForte12345";

describe("Procedures (e2e)", () => {
  let app: NestExpressApplication;
  let tokenAdmin: string;
  let tokenDentist: string;
  let tokenReceptionist: string;
  let tokenFreelancer: string;
  let tokenAdmin2: string;
  let orgAId: string;
  let createdId: string;

  function as(token: string) {
    const srv = () => request(app.getHttpServer());
    return {
      get: (url: string) => srv().get(url).set("Authorization", `Bearer ${token}`),
      post: (url: string, body?: object) => srv().post(url).set("Authorization", `Bearer ${token}`).send(body),
      patch: (url: string, body?: object) => srv().patch(url).set("Authorization", `Bearer ${token}`).send(body),
      delete: (url: string) => srv().delete(url).set("Authorization", `Bearer ${token}`),
    };
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.init();

    await teardownAll(rawPrisma);
    const hash = await bcrypt.hash(TEST_PASSWORD, 10);
    const ts = Date.now();

    // ── Org A ────────────────────────────────────────────────────────────────
    const orgA = await rawPrisma.organization.create({ data: { name: "Procedures Org A" } });
    orgAId = orgA.id;

    const adminUser = await rawPrisma.user.create({
      data: { organizationId: orgAId, email: `proc-admin-${ts}@test.com`, passwordHash: hash, name: "Admin P", roles: ["ADMIN"] },
    });
    await rawPrisma.organization.update({ where: { id: orgAId }, data: { foundingAdminUserId: adminUser.id } });

    const dentistUser = await rawPrisma.user.create({
      data: { organizationId: orgAId, email: `proc-dent-${ts}@test.com`, passwordHash: hash, name: "Dentist P", roles: ["DENTIST"] },
    });

    const recUser = await rawPrisma.user.create({
      data: { organizationId: orgAId, email: `proc-rec-${ts}@test.com`, passwordHash: hash, name: "Rec P", roles: ["RECEPTIONIST"] },
    });

    // Freelancer: ADMIN+DENTIST (mesmo padrão do platform.service ao criar org FREELANCER)
    const freelancerUser = await rawPrisma.user.create({
      data: { organizationId: orgAId, email: `proc-free-${ts}@test.com`, passwordHash: hash, name: "Freelancer P", roles: ["ADMIN", "DENTIST"] },
    });

    // ── Org B ────────────────────────────────────────────────────────────────
    const orgB = await rawPrisma.organization.create({ data: { name: "Procedures Org B" } });
    const admin2User = await rawPrisma.user.create({
      data: { organizationId: orgB.id, email: `proc-admin2-${ts}@test.com`, passwordHash: hash, name: "Admin2 P", roles: ["ADMIN"] },
    });
    await rawPrisma.organization.update({ where: { id: orgB.id }, data: { foundingAdminUserId: admin2User.id } });

    // ── Seed: um procedimento pré-existente na Org A ─────────────────────────
    const existing = await rawPrisma.procedureCatalog.create({
      data: { organizationId: orgAId, name: "Consulta Inicial", defaultValue: 150 },
    });
    createdId = existing.id;

    // ── Tokens ────────────────────────────────────────────────────────────────
    const login = async (email: string) => {
      const res = await request(app.getHttpServer()).post("/auth/login").send({ identifier: email, password: TEST_PASSWORD });
      return res.body.accessToken as string;
    };
    tokenAdmin = await login(adminUser.email);
    tokenDentist = await login(dentistUser.email);
    tokenReceptionist = await login(recUser.email);
    tokenFreelancer = await login(freelancerUser.email);
    tokenAdmin2 = await login(admin2User.email);
  }, 30000);

  afterAll(async () => {
    await app.close();
    await rawPrisma.$disconnect();
  });

  // ── GET /procedures ───────────────────────────────────────────────────────

  it("ADMIN lista procedimentos da org", async () => {
    const res = await as(tokenAdmin).get("/procedures");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some((p: { id: string }) => p.id === createdId)).toBe(true);
  });

  it("DENTIST lista procedimentos (somente leitura)", async () => {
    const res = await as(tokenDentist).get("/procedures");
    expect(res.status).toBe(200);
    expect(res.body.some((p: { id: string }) => p.id === createdId)).toBe(true);
  });

  it("RECEPTIONIST lista procedimentos (somente leitura)", async () => {
    const res = await as(tokenReceptionist).get("/procedures");
    expect(res.status).toBe(200);
  });

  it("ADMIN2 (Org B) não enxerga procedimentos da Org A na listagem", async () => {
    const res = await as(tokenAdmin2).get("/procedures");
    expect(res.status).toBe(200);
    expect(res.body.some((p: { id: string }) => p.id === createdId)).toBe(false);
  });

  // ── POST /procedures ──────────────────────────────────────────────────────

  it("ADMIN cria procedimento (201)", async () => {
    const res = await as(tokenAdmin).post("/procedures", { name: "Limpeza", defaultValue: 180 });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Limpeza");
    expect(res.body.active).toBe(true);
  });

  it("FREELANCER (ADMIN+DENTIST) cria procedimento (201)", async () => {
    const res = await as(tokenFreelancer).post("/procedures", { name: "Canal Freelancer", defaultValue: 900 });
    expect(res.status).toBe(201);
  });

  it("DENTIST não pode criar procedimento (403)", async () => {
    const res = await as(tokenDentist).post("/procedures", { name: "Bloqueado", defaultValue: 100 });
    expect(res.status).toBe(403);
  });

  it("RECEPTIONIST não pode criar procedimento (403)", async () => {
    const res = await as(tokenReceptionist).post("/procedures", { name: "Bloqueado", defaultValue: 100 });
    expect(res.status).toBe(403);
  });

  // ── PATCH /procedures/:id ─────────────────────────────────────────────────

  it("ADMIN edita procedimento (200)", async () => {
    const res = await as(tokenAdmin).patch(`/procedures/${createdId}`, { name: "Consulta Atualizada" });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Consulta Atualizada");
  });

  it("FREELANCER edita procedimento (200)", async () => {
    const res = await as(tokenFreelancer).patch(`/procedures/${createdId}`, { defaultValue: 200 });
    expect(res.status).toBe(200);
  });

  it("DENTIST não pode editar procedimento (403)", async () => {
    const res = await as(tokenDentist).patch(`/procedures/${createdId}`, { name: "Hack" });
    expect(res.status).toBe(403);
  });

  it("ADMIN2 (Org B) não pode editar procedimento da Org A (404)", async () => {
    const res = await as(tokenAdmin2).patch(`/procedures/${createdId}`, { name: "Hack" });
    expect(res.status).toBe(404);
  });

  // ── DELETE /procedures/:id (soft-delete) ──────────────────────────────────

  it("ADMIN soft-deleta procedimento: active=false (200)", async () => {
    // Cria um procedimento para deletar sem afetar outros testes
    const created = await as(tokenAdmin).post("/procedures", { name: "Para Deletar", defaultValue: 50 });
    expect(created.status).toBe(201);
    const id = created.body.id;

    const del = await as(tokenAdmin).delete(`/procedures/${id}`);
    expect(del.status).toBe(200);
    expect(del.body.active).toBe(false);
  });

  it("FREELANCER soft-deleta procedimento (200)", async () => {
    const created = await as(tokenFreelancer).post("/procedures", { name: "Para Deletar Freelancer", defaultValue: 50 });
    expect(created.status).toBe(201);

    const del = await as(tokenFreelancer).delete(`/procedures/${created.body.id}`);
    expect(del.status).toBe(200);
    expect(del.body.active).toBe(false);
  });

  it("DENTIST não pode soft-deletar (403)", async () => {
    const res = await as(tokenDentist).delete(`/procedures/${createdId}`);
    expect(res.status).toBe(403);
  });

  it("ADMIN2 (Org B) não pode soft-deletar procedimento da Org A (404)", async () => {
    const res = await as(tokenAdmin2).delete(`/procedures/${createdId}`);
    expect(res.status).toBe(404);
  });
});
