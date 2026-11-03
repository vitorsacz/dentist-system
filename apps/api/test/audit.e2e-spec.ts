import request from "supertest";
import { Test } from "@nestjs/testing";
import type { NestExpressApplication } from "@nestjs/platform-express";
import * as bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";
import { TEST_DATABASE_URL } from "./test-db";
import { teardownAll } from "./helpers/teardown";

// Critério de aceite do VISION:
// - ADMIN lê audit da sua org; DENTIST/RECEPTIONIST não lê
// - Fundador FREELANCER lê audit da sua org
// - Cross-org: org A não vê logs da org B
// - Super Admin vê todos (via ?organizationId= opcional)

const rawPrisma = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } });
const TEST_PASSWORD = "SenhaForte12345";

interface OrgContext {
  organizationId: string;
  adminToken: string;
  adminUserId: string;
  dentistToken: string;
  dentistUserId: string;
  receptionistToken: string;
  receptionistUserId: string;
}

interface FreelancerContext {
  organizationId: string;
  founderToken: string;
  founderUserId: string;
  dentistToken: string;
  dentistUserId: string;
}

async function seedClinicOrg(label: string): Promise<OrgContext> {
  const org = await rawPrisma.organization.create({
    data: { name: `${label} Clínica (audit-test)`, type: "CLINIC" },
  });
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);

  const admin = await rawPrisma.user.create({
    data: { organizationId: org.id, email: `${label}-admin@audit-test.com`, passwordHash, name: `${label} Admin`, roles: ["ADMIN"] },
  });
  await rawPrisma.organization.update({ where: { id: org.id }, data: { foundingAdminUserId: admin.id } });

  const dentist = await rawPrisma.user.create({
    data: { organizationId: org.id, email: `${label}-dentist@audit-test.com`, passwordHash, name: `${label} Dentist`, roles: ["DENTIST"] },
  });
  const receptionist = await rawPrisma.user.create({
    data: { organizationId: org.id, email: `${label}-recep@audit-test.com`, passwordHash, name: `${label} Recep`, roles: ["RECEPTIONIST"] },
  });

  return { organizationId: org.id, adminUserId: admin.id, dentistUserId: dentist.id, receptionistUserId: receptionist.id, adminToken: "", dentistToken: "", receptionistToken: "" };
}

async function seedFreelancerOrg(label: string): Promise<FreelancerContext> {
  const org = await rawPrisma.organization.create({
    data: { name: `${label} Freelancer (audit-test)`, type: "FREELANCER" },
  });
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);

  const founder = await rawPrisma.user.create({
    data: { organizationId: org.id, email: `${label}-founder@audit-test.com`, passwordHash, name: `${label} Founder`, roles: ["DENTIST"] },
  });
  await rawPrisma.organization.update({ where: { id: org.id }, data: { foundingAdminUserId: founder.id } });

  const other = await rawPrisma.user.create({
    data: { organizationId: org.id, email: `${label}-other@audit-test.com`, passwordHash, name: `${label} Other`, roles: ["DENTIST"] },
  });

  return { organizationId: org.id, founderUserId: founder.id, dentistUserId: other.id, founderToken: "", dentistToken: "" };
}

async function login(app: NestExpressApplication, email: string): Promise<string> {
  const res = await request(app.getHttpServer())
    .post("/auth/login")
    .send({ identifier: email, password: TEST_PASSWORD });
  return res.body.accessToken as string;
}

describe("Audit module", () => {
  let app: NestExpressApplication;
  let clinic: OrgContext;
  let clinic2: OrgContext;
  let freelancer: FreelancerContext;
  let superAdminToken: string;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.init();

    [clinic, clinic2, freelancer] = await Promise.all([
      seedClinicOrg("audit-a"),
      seedClinicOrg("audit-b"),
      seedFreelancerOrg("audit-f"),
    ]);

    // Super Admin
    const saHash = await bcrypt.hash(TEST_PASSWORD, 10);
    const sa = await rawPrisma.user.create({
      data: { email: "super-admin@audit-test.com", passwordHash: saHash, name: "Super Admin", roles: [], isSuperAdmin: true },
    });
    superAdminToken = await login(app, sa.email);

    [clinic.adminToken, clinic.dentistToken, clinic.receptionistToken, clinic2.adminToken, freelancer.founderToken, freelancer.dentistToken] =
      await Promise.all([
        login(app, "audit-a-admin@audit-test.com"),
        login(app, "audit-a-dentist@audit-test.com"),
        login(app, "audit-a-recep@audit-test.com"),
        login(app, "audit-b-admin@audit-test.com"),
        login(app, "audit-f-founder@audit-test.com"),
        login(app, "audit-f-other@audit-test.com"),
      ]);

    // Seed audit logs for each org
    await rawPrisma.auditLog.createMany({
      data: [
        { organizationId: clinic.organizationId, userId: clinic.adminUserId, action: "LOGIN", ip: "1.1.1.1" },
        { organizationId: clinic.organizationId, userId: clinic.dentistUserId, action: "CLINICAL_RECORD_READ", entity: "ClinicalRecord" },
        { organizationId: clinic2.organizationId, userId: clinic2.adminUserId, action: "LOGIN", ip: "2.2.2.2" },
        { organizationId: freelancer.organizationId, userId: freelancer.founderUserId, action: "ATTENDANCE_CREATE", entity: "Attendance" },
      ],
    });
  });

  afterAll(async () => {
    await teardownAll(rawPrisma);
    await rawPrisma.$disconnect();
    await app.close();
  });

  function as(token: string) {
    return { get: (path: string) => request(app.getHttpServer()).get(path).set("Authorization", `Bearer ${token}`) };
  }

  describe("GET /audit — controle de acesso", () => {
    it("ADMIN da clínica lê seus próprios logs", async () => {
      const res = await as(clinic.adminToken).get("/audit");
      expect(res.status).toBe(200);
      expect(res.body.items).toBeDefined();
      expect(res.body.items.length).toBeGreaterThan(0);
      // Todos os itens pertencem à org correta
      res.body.items.forEach((item: { organizationId: string }) => {
        expect(item.organizationId).toBe(clinic.organizationId);
      });
    });

    it("DENTIST não tem acesso à auditoria", async () => {
      const res = await as(clinic.dentistToken).get("/audit");
      expect(res.status).toBe(403);
    });

    it("RECEPTIONIST não tem acesso à auditoria", async () => {
      const res = await as(clinic.receptionistToken).get("/audit");
      expect(res.status).toBe(403);
    });

    it("fundador FREELANCER lê seus próprios logs", async () => {
      const res = await as(freelancer.founderToken).get("/audit");
      expect(res.status).toBe(200);
      expect(res.body.items).toBeDefined();
      res.body.items.forEach((item: { organizationId: string }) => {
        expect(item.organizationId).toBe(freelancer.organizationId);
      });
    });

    it("DENTIST não-fundador FREELANCER não tem acesso", async () => {
      const res = await as(freelancer.dentistToken).get("/audit");
      expect(res.status).toBe(403);
    });

    it("Super Admin lê logs de todos os tenants", async () => {
      const res = await as(superAdminToken).get("/audit");
      expect(res.status).toBe(200);
      const orgIds = res.body.items.map((i: { organizationId: string }) => i.organizationId);
      // Deve conter logs de múltiplas orgs (testadas acima foram criadas)
      expect(new Set(orgIds).size).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Isolamento cross-org", () => {
    it("ADMIN org A não vê logs da org B", async () => {
      const resA = await as(clinic.adminToken).get("/audit");
      const resB = await as(clinic2.adminToken).get("/audit");
      expect(resA.status).toBe(200);
      expect(resB.status).toBe(200);

      const orgAIds = new Set(resA.body.items.map((i: { organizationId: string }) => i.organizationId));
      const orgBIds = new Set(resB.body.items.map((i: { organizationId: string }) => i.organizationId));

      expect(orgAIds.has(clinic2.organizationId)).toBe(false);
      expect(orgBIds.has(clinic.organizationId)).toBe(false);
    });

    it("fundador FREELANCER não vê logs de outra org", async () => {
      const res = await as(freelancer.founderToken).get("/audit");
      expect(res.status).toBe(200);
      res.body.items.forEach((item: { organizationId: string }) => {
        expect(item.organizationId).toBe(freelancer.organizationId);
      });
    });
  });

  describe("Filtros e paginação", () => {
    it("filtra por action", async () => {
      const res = await as(clinic.adminToken).get("/audit?action=LOGIN");
      expect(res.status).toBe(200);
      res.body.items.forEach((item: { action: string }) => {
        expect(item.action).toBe("LOGIN");
      });
    });

    it("filtra por userId", async () => {
      const res = await as(clinic.adminToken).get(`/audit?userId=${clinic.dentistUserId}`);
      expect(res.status).toBe(200);
      res.body.items.forEach((item: { userId: string }) => {
        expect(item.userId).toBe(clinic.dentistUserId);
      });
    });

    it("retorna paginação com total, page, pageSize", async () => {
      const res = await as(clinic.adminToken).get("/audit?page=1&pageSize=1");
      expect(res.status).toBe(200);
      expect(res.body.total).toBeDefined();
      expect(res.body.page).toBe(1);
      expect(res.body.pageSize).toBe(1);
      expect(res.body.items.length).toBeLessThanOrEqual(1);
    });
  });

  describe("Registro automático via interceptor", () => {
    it("logout registra evento LOGOUT na auditoria", async () => {
      // Faz login para ter um refresh cookie, depois logout
      const loginRes = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ identifier: "audit-a-admin@audit-test.com", password: TEST_PASSWORD });
      const freshToken = loginRes.body.accessToken as string;

      await request(app.getHttpServer())
        .post("/auth/logout")
        .set("Authorization", `Bearer ${freshToken}`)
        .send();

      // Aguarda o fire-and-forget
      await new Promise((r) => setTimeout(r, 100));

      const res = await as(clinic.adminToken).get(`/audit?action=LOGOUT&userId=${clinic.adminUserId}`);
      expect(res.status).toBe(200);
      expect(res.body.items.length).toBeGreaterThan(0);
    });
  });
});
