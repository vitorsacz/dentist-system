import request from "supertest";
import { Test } from "@nestjs/testing";
import type { NestExpressApplication } from "@nestjs/platform-express";
import * as bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";
import { TEST_DATABASE_URL } from "./test-db";
import { teardownAll } from "./helpers/teardown";

// R3: primeiro login de usuário novo força troca de senha.
// R5: Super Admin reseta senha → troca obrigatória no próximo login.

const rawPrisma = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } });
const TEST_PASSWORD = "SenhaForte12345";
const NEW_PASSWORD = "NovaSenha99999";

async function seedSuperAdmin() {
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
  return rawPrisma.user.create({
    data: {
      email: `super-mcp-${Date.now()}@test.com`,
      passwordHash,
      name: "Super Admin MCP",
      roles: [],
      isSuperAdmin: true,
    },
  });
}

describe("R3/R5 — mustChangePassword first-login flow", () => {
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

  describe("new user created by ADMIN", () => {
    it("login returns requiresPasswordChange with changeToken", async () => {
      const superAdmin = await seedSuperAdmin();
      const saLoginRes = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ identifier: superAdmin.email, password: TEST_PASSWORD });
      const saToken = saLoginRes.body.accessToken as string;

      // Super Admin creates org.
      const orgRes = await request(app.getHttpServer())
        .post("/platform/organizations")
        .set("Authorization", `Bearer ${saToken}`)
        .send({
          name: "Test Org MCP",
          type: "CLINIC",
          foundingAdminEmail: `admin-mcp-${Date.now()}@test.com`,
          foundingAdminName: "Admin MCP",
          foundingAdminPassword: TEST_PASSWORD,
        })
        .expect(201);
      const orgId = orgRes.body.id as string;

      // Find the founding admin user.
      const admin = await rawPrisma.user.findFirst({ where: { organizationId: orgId, roles: { has: "ADMIN" } } });
      expect(admin?.mustChangePassword).toBe(true);

      // Login as founding admin → must get requiresPasswordChange.
      const loginRes = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ identifier: admin!.email, password: TEST_PASSWORD })
        .expect(200);
      expect(loginRes.body.requiresPasswordChange).toBe(true);
      expect(loginRes.body.changeToken).toBeDefined();
      expect(loginRes.body.accessToken).toBeUndefined();
    });

    it("changeToken allows setting new password and returns real tokens", async () => {
      const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
      const org = await rawPrisma.organization.create({ data: { name: "Org Set PW" } });
      const user = await rawPrisma.user.create({
        data: {
          organizationId: org.id,
          email: `set-pw-${Date.now()}@test.com`,
          passwordHash,
          name: "Set PW User",
          roles: ["ADMIN"],
          mustChangePassword: true,
        },
      });
      await rawPrisma.organization.update({ where: { id: org.id }, data: { foundingAdminUserId: user.id } });

      const loginRes = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ identifier: user.email, password: TEST_PASSWORD })
        .expect(200);
      expect(loginRes.body.requiresPasswordChange).toBe(true);
      const { changeToken } = loginRes.body as { changeToken: string };

      // Set new password.
      const setRes = await request(app.getHttpServer())
        .post("/auth/set-initial-password")
        .send({ changeToken, newPassword: NEW_PASSWORD })
        .expect(200);
      expect(setRes.body.accessToken).toBeDefined();

      // mustChangePassword is now false.
      const updated = await rawPrisma.user.findUnique({ where: { id: user.id } });
      expect(updated?.mustChangePassword).toBe(false);

      // Can log in normally with new password.
      const normalLoginRes = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ identifier: user.email, password: NEW_PASSWORD })
        .expect(200);
      expect(normalLoginRes.body.accessToken).toBeDefined();
      expect(normalLoginRes.body.requiresPasswordChange).toBeUndefined();
    });

    it("invalid changeToken is rejected", async () => {
      await request(app.getHttpServer())
        .post("/auth/set-initial-password")
        .send({ changeToken: "not-a-valid-token", newPassword: NEW_PASSWORD })
        .expect(401);
    });
  });

  describe("R5: Super Admin resets password", () => {
    it("reset sets mustChangePassword; next login forces password change", async () => {
      const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
      const org = await rawPrisma.organization.create({ data: { name: "Org R5 Test" } });
      const user = await rawPrisma.user.create({
        data: {
          organizationId: org.id,
          email: `r5-${Date.now()}@test.com`,
          passwordHash,
          name: "R5 User",
          roles: ["ADMIN"],
          mustChangePassword: false,
        },
      });
      await rawPrisma.organization.update({ where: { id: org.id }, data: { foundingAdminUserId: user.id } });

      // User can log in normally (mustChangePassword=false).
      const before = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ identifier: user.email, password: TEST_PASSWORD })
        .expect(200);
      expect(before.body.accessToken).toBeDefined();

      // Super Admin resets password.
      const superAdmin = await seedSuperAdmin();
      const saLoginRes = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ identifier: superAdmin.email, password: TEST_PASSWORD });
      const saToken = saLoginRes.body.accessToken as string;

      await request(app.getHttpServer())
        .patch(`/platform/organizations/${org.id}/users/${user.id}/reset-password`)
        .set("Authorization", `Bearer ${saToken}`)
        .send({ password: "ResetPass999!" })
        .expect(200);

      // mustChangePassword is now true.
      const updated = await rawPrisma.user.findUnique({ where: { id: user.id } });
      expect(updated?.mustChangePassword).toBe(true);

      // Next login with new password forces password change.
      const afterReset = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ identifier: user.email, password: "ResetPass999!" })
        .expect(200);
      expect(afterReset.body.requiresPasswordChange).toBe(true);
      expect(afterReset.body.changeToken).toBeDefined();
    });
  });
});
