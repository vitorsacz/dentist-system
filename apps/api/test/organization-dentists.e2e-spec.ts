import request from "supertest";
import { Test } from "@nestjs/testing";
import type { NestExpressApplication } from "@nestjs/platform-express";
import * as bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";
import { TEST_DATABASE_URL } from "./test-db";
import { teardownAll } from "./helpers/teardown";

const rawPrisma = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } });
const TEST_PASSWORD = "SenhaForte12345";

describe("GET /organization/dentists (e2e)", () => {
  let app: NestExpressApplication;

  let adminToken: string;
  let receptionistToken: string;
  let dentistToken: string;
  let dentistId: string;
  let adminBToken: string;
  let dentistBId: string;

  async function loginAs(email: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ identifier: email, password: TEST_PASSWORD });
    return res.body.accessToken as string;
  }

  function as(token: string) {
    return { get: (url: string) => request(app.getHttpServer()).get(url).set("Authorization", `Bearer ${token}`) };
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
    const orgA = await rawPrisma.organization.create({ data: { name: "OrgDentists Test A" } });

    const admin = await rawPrisma.user.create({
      data: {
        organizationId: orgA.id,
        email: `od-admin-${ts}@test.com`,
        passwordHash: hash,
        name: "Admin OrgDentists",
        roles: ["ADMIN"],
      },
    });
    await rawPrisma.organization.update({ where: { id: orgA.id }, data: { foundingAdminUserId: admin.id } });

    const dentist = await rawPrisma.user.create({
      data: {
        organizationId: orgA.id,
        email: `od-dentist-${ts}@test.com`,
        passwordHash: hash,
        name: "Dentista OrgDentists",
        nickname: `dr-od-${ts}`,
        roles: ["DENTIST"],
        colorToken: "SUCCESS",
      },
    });
    dentistId = dentist.id;

    const receptionist = await rawPrisma.user.create({
      data: {
        organizationId: orgA.id,
        email: `od-rec-${ts}@test.com`,
        passwordHash: hash,
        name: "Recepcionista OrgDentists",
        roles: ["RECEPTIONIST"],
      },
    });

    adminToken = await loginAs(admin.email);
    dentistToken = await loginAs(dentist.email);
    receptionistToken = await loginAs(receptionist.email);

    // ── Org B ────────────────────────────────────────────────────────────────
    const orgB = await rawPrisma.organization.create({ data: { name: "OrgDentists Test B" } });

    const adminB = await rawPrisma.user.create({
      data: {
        organizationId: orgB.id,
        email: `od-admin-b-${ts}@test.com`,
        passwordHash: hash,
        name: "Admin B OrgDentists",
        roles: ["ADMIN"],
      },
    });
    await rawPrisma.organization.update({ where: { id: orgB.id }, data: { foundingAdminUserId: adminB.id } });

    const dentistB = await rawPrisma.user.create({
      data: {
        organizationId: orgB.id,
        email: `od-dentist-b-${ts}@test.com`,
        passwordHash: hash,
        name: "Dentista B",
        roles: ["DENTIST"],
      },
    });
    dentistBId = dentistB.id;

    adminBToken = await loginAs(adminB.email);
  }, 30000);

  afterAll(async () => {
    await app.close();
    await rawPrisma.$disconnect();
  });

  it("ADMIN vê lista de dentistas com campos id, name, nickname, colorToken, active", async () => {
    const res = await as(adminToken).get("/organization/dentists");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const dentist = res.body.find((d: { id: string }) => d.id === dentistId);
    expect(dentist).toBeDefined();
    expect(dentist).toMatchObject({
      id: dentistId,
      name: "Dentista OrgDentists",
      colorToken: "SUCCESS",
      active: true,
    });
    expect("nickname" in dentist).toBe(true);
    // userId não deve existir (campo renomeado para id)
    expect("userId" in dentist).toBe(false);
  });

  it("RECEPTIONIST vê lista de dentistas", async () => {
    const res = await as(receptionistToken).get("/organization/dentists");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some((d: { id: string }) => d.id === dentistId)).toBe(true);
  });

  it("DENTIST recebe 403", async () => {
    const res = await as(dentistToken).get("/organization/dentists");
    expect(res.status).toBe(403);
  });

  it("ADMIN de Org B não vê dentistas de Org A (isolamento)", async () => {
    const res = await as(adminBToken).get("/organization/dentists");
    expect(res.status).toBe(200);
    const ids = res.body.map((d: { id: string }) => d.id);
    expect(ids).not.toContain(dentistId);
    expect(ids).toContain(dentistBId);
  });

  it("lista só inclui dentistas ativos", async () => {
    const res = await as(adminToken).get("/organization/dentists");
    expect(res.status).toBe(200);
    expect(res.body.every((d: { active: boolean }) => d.active === true)).toBe(true);
  });
});
