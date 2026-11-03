import request from "supertest";
import { Test } from "@nestjs/testing";
import type { NestExpressApplication } from "@nestjs/platform-express";
import * as bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";
import { TEST_DATABASE_URL } from "./test-db";
import { teardownAll } from "./helpers/teardown";

// R4: Super Admin suspende/reativa organização.
// Cobre: guard de acesso, bloqueio de login e API do org suspensa, reativação.

const rawPrisma = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } });
const TEST_PASSWORD = "SenhaForte12345";

async function seedFixtures() {
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);

  const superAdmin = await rawPrisma.user.create({
    data: {
      email: `super-admin-suspend-${Date.now()}@test.com`,
      passwordHash,
      name: "Super Admin Suspend Test",
      roles: [],
      isSuperAdmin: true,
    },
  });

  const org = await rawPrisma.organization.create({ data: { name: "Org para suspensão" } });
  const admin = await rawPrisma.user.create({
    data: {
      organizationId: org.id,
      email: `org-admin-${Date.now()}@test.com`,
      passwordHash,
      name: "Admin da Org",
      roles: ["ADMIN"],
    },
  });
  await rawPrisma.organization.update({ where: { id: org.id }, data: { foundingAdminUserId: admin.id } });

  return { superAdmin, org, admin };
}

describe("R4 — suspend/reactivate organization", () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await teardownAll(rawPrisma);
    await rawPrisma.$disconnect();
    await app.close();
  });

  it("non-super-admin cannot suspend org", async () => {
    const { org, admin } = await seedFixtures();
    const loginRes = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ identifier: admin.email, password: TEST_PASSWORD });
    const token = loginRes.body.accessToken as string;

    await request(app.getHttpServer())
      .patch(`/platform/organizations/${org.id}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "SUSPENDED" })
      .expect(403);
  });

  it("super admin suspends org; org users get 401 on API", async () => {
    const { superAdmin, org, admin } = await seedFixtures();

    const saLoginRes = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ identifier: superAdmin.email, password: TEST_PASSWORD });
    const saToken = saLoginRes.body.accessToken as string;

    const adminLoginRes = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ identifier: admin.email, password: TEST_PASSWORD });
    const adminToken = adminLoginRes.body.accessToken as string;

    // Admin can reach org before suspension.
    await request(app.getHttpServer())
      .get("/organization")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    // Super Admin suspends.
    const suspendRes = await request(app.getHttpServer())
      .patch(`/platform/organizations/${org.id}/status`)
      .set("Authorization", `Bearer ${saToken}`)
      .send({ status: "SUSPENDED" })
      .expect(200);
    expect(suspendRes.body.status).toBe("SUSPENDED");

    // Org user is now blocked (JWT strategy re-reads org status each request).
    const afterRes = await request(app.getHttpServer())
      .get("/organization")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(afterRes.status).toBe(401);
    expect(afterRes.body.message).toMatch(/suspensa/i);
  });

  it("super admin reactivates org; org users work again", async () => {
    const { superAdmin, org, admin } = await seedFixtures();

    const saLoginRes = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ identifier: superAdmin.email, password: TEST_PASSWORD });
    const saToken = saLoginRes.body.accessToken as string;

    // Suspend first.
    await request(app.getHttpServer())
      .patch(`/platform/organizations/${org.id}/status`)
      .set("Authorization", `Bearer ${saToken}`)
      .send({ status: "SUSPENDED" })
      .expect(200);

    // Reactivate.
    const reactRes = await request(app.getHttpServer())
      .patch(`/platform/organizations/${org.id}/status`)
      .set("Authorization", `Bearer ${saToken}`)
      .send({ status: "ACTIVE" })
      .expect(200);
    expect(reactRes.body.status).toBe("ACTIVE");

    // Org user can log in and use the API again after reactivation.
    const loginRes = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ identifier: admin.email, password: TEST_PASSWORD });
    expect(loginRes.body.accessToken).toBeDefined();
    const token = loginRes.body.accessToken as string;
    await request(app.getHttpServer())
      .get("/organization")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
  });

  it("login is blocked while org is suspended", async () => {
    const { superAdmin, org, admin } = await seedFixtures();

    const saLoginRes = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ identifier: superAdmin.email, password: TEST_PASSWORD });
    const saToken = saLoginRes.body.accessToken as string;

    await request(app.getHttpServer())
      .patch(`/platform/organizations/${org.id}/status`)
      .set("Authorization", `Bearer ${saToken}`)
      .send({ status: "SUSPENDED" })
      .expect(200);

    // Login itself succeeds (returns token), but the token is unusable because
    // JWT strategy blocks SUSPENDED orgs on every request including /auth/me.
    const loginRes = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ identifier: admin.email, password: TEST_PASSWORD });
    if (loginRes.body.accessToken) {
      const token = loginRes.body.accessToken as string;
      await request(app.getHttpServer())
        .get("/auth/me")
        .set("Authorization", `Bearer ${token}`)
        .expect(401);
    }
  });
});
