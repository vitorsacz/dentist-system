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

/**
 * Personas (single org unless stated):
 *   ADMIN  — can toggle any patient/clinic
 *   OWNER  — DENTIST, ownerDentistId of P1
 *   OTHER  — DENTIST, does NOT own P1
 *   REC    — RECEPTIONIST, cannot toggle
 *   ADMIN2 — ADMIN in a different org (IDOR guard)
 */
describe("SoftDelete (e2e)", () => {
  let app: NestExpressApplication;
  let tokenAdmin: string;
  let tokenOwner: string;
  let tokenOther: string;
  let tokenRec: string;
  let tokenAdmin2: string;

  let orgId: string;
  let org2Id: string;
  let ownerId: string;
  let clinicId: string;
  let clinic2Id: string; // second clinic so we can deactivate clinicId without hitting last-active block
  let patientId: string; // owned by OWNER
  let procedureId: string;

  function as(token: string) {
    const srv = () => request(app.getHttpServer());
    return {
      get: (url: string) => srv().get(url).set("Authorization", `Bearer ${token}`),
      post: (url: string, body?: object) =>
        srv().post(url).set("Authorization", `Bearer ${token}`).send(body),
      patch: (url: string, body?: object) =>
        srv().patch(url).set("Authorization", `Bearer ${token}`).send(body),
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

    // ── Org 1 ──────────────────────────────────────────────────────────────────
    const org = await rawPrisma.organization.create({ data: { name: "SoftDelete Org" } });
    orgId = org.id;

    const adminUser = await rawPrisma.user.create({
      data: { organizationId: orgId, email: `sd-admin-${ts}@test.com`, passwordHash: hash, name: "Admin SD", roles: ["ADMIN"] },
    });
    await rawPrisma.organization.update({ where: { id: orgId }, data: { foundingAdminUserId: adminUser.id } });

    const ownerUser = await rawPrisma.user.create({
      data: { organizationId: orgId, email: `sd-owner-${ts}@test.com`, passwordHash: hash, name: "Owner SD", roles: ["DENTIST"] },
    });
    ownerId = ownerUser.id;

    const otherUser = await rawPrisma.user.create({
      data: { organizationId: orgId, email: `sd-other-${ts}@test.com`, passwordHash: hash, name: "Other SD", roles: ["DENTIST"] },
    });

    const recUser = await rawPrisma.user.create({
      data: { organizationId: orgId, email: `sd-rec-${ts}@test.com`, passwordHash: hash, name: "Rec SD", roles: ["RECEPTIONIST"] },
    });

    // ── Org 2 ──────────────────────────────────────────────────────────────────
    const org2 = await rawPrisma.organization.create({ data: { name: "SoftDelete Org2" } });
    org2Id = org2.id;

    const admin2User = await rawPrisma.user.create({
      data: { organizationId: org2Id, email: `sd-admin2-${ts}@test.com`, passwordHash: hash, name: "Admin2 SD", roles: ["ADMIN"] },
    });
    await rawPrisma.organization.update({ where: { id: org2Id }, data: { foundingAdminUserId: admin2User.id } });

    // ── Fixtures ──────────────────────────────────────────────────────────────
    const patient = await rawPrisma.patient.create({
      data: { organizationId: orgId, name: "SD Patient", phone: "11900000001", createdByUserId: ownerUser.id, ownerDentistId: ownerUser.id },
    });
    patientId = patient.id;

    const c1 = await rawPrisma.clinic.create({
      data: { organizationId: orgId, name: "Consultório SD-1", type: "OWN", colorToken: "BRAND" },
    });
    clinicId = c1.id;

    const c2 = await rawPrisma.clinic.create({
      data: { organizationId: orgId, name: "Consultório SD-2", type: "OWN", colorToken: "SUCCESS" },
    });
    clinic2Id = c2.id;

    const proc = await rawPrisma.procedureCatalog.create({
      data: { organizationId: orgId, name: "Consulta SD", defaultValue: 100 },
    });
    procedureId = proc.id;

    // ── Tokens ────────────────────────────────────────────────────────────────
    const login = async (email: string) => {
      const res = await request(app.getHttpServer()).post("/auth/login").send({ identifier: email, password: TEST_PASSWORD });
      return res.body.accessToken as string;
    };
    tokenAdmin = await login(adminUser.email);
    tokenOwner = await login(ownerUser.email);
    tokenOther = await login(otherUser.email);
    tokenRec = await login(recUser.email);
    tokenAdmin2 = await login(admin2User.email);
  }, 30000);

  afterAll(async () => {
    await app.close();
    await rawPrisma.$disconnect();
  });

  // ── Reset active flags between groups ─────────────────────────────────────
  async function resetPatientActive(active = true) {
    await rawPrisma.patient.update({ where: { id: patientId }, data: { active } });
  }
  async function resetClinicActive(id = clinicId, active = true) {
    await rawPrisma.clinic.update({ where: { id }, data: { active } });
  }

  // ── Patient toggle ─────────────────────────────────────────────────────────
  describe("PATCH /patients/:id/active — patient toggle", () => {
    beforeEach(() => resetPatientActive(true));

    it("ADMIN can deactivate", async () => {
      const res = await as(tokenAdmin).patch(`/patients/${patientId}/active`, { active: false }).expect(200);
      expect(res.body.active).toBe(false);
    });

    it("OWNER (dentist) can deactivate own patient", async () => {
      const res = await as(tokenOwner).patch(`/patients/${patientId}/active`, { active: false }).expect(200);
      expect(res.body.active).toBe(false);
    });

    it("OWNER can reactivate", async () => {
      await rawPrisma.patient.update({ where: { id: patientId }, data: { active: false } });
      const res = await as(tokenOwner).patch(`/patients/${patientId}/active`, { active: true }).expect(200);
      expect(res.body.active).toBe(true);
    });

    it("OTHER dentist (non-owner) gets 404 (not in scope)", async () => {
      await as(tokenOther).patch(`/patients/${patientId}/active`, { active: false }).expect(404);
    });

    it("RECEPTIONIST gets 403", async () => {
      await as(tokenRec).patch(`/patients/${patientId}/active`, { active: false }).expect(403);
    });

    it("ADMIN of another org gets 404 (IDOR)", async () => {
      await as(tokenAdmin2).patch(`/patients/${patientId}/active`, { active: false }).expect(404);
    });

    it("idempotent — same active value returns 200 unchanged", async () => {
      const res = await as(tokenAdmin).patch(`/patients/${patientId}/active`, { active: true }).expect(200);
      expect(res.body.active).toBe(true);
    });
  });

  // ── Patient list filter ────────────────────────────────────────────────────
  describe("GET /patients — includeInactive filter", () => {
    beforeAll(() => resetPatientActive(false));
    afterAll(() => resetPatientActive(true));

    it("default list hides inactive patient", async () => {
      const res = await as(tokenAdmin).get("/patients").expect(200);
      const ids = res.body.map((p: { id: string }) => p.id);
      expect(ids).not.toContain(patientId);
    });

    it("ADMIN + includeInactive=true sees inactive patient", async () => {
      const res = await as(tokenAdmin).get("/patients?includeInactive=true").expect(200);
      const ids = res.body.map((p: { id: string }) => p.id);
      expect(ids).toContain(patientId);
    });

    it("non-ADMIN ignores includeInactive — still hides inactive", async () => {
      const res = await as(tokenOwner).get("/patients?includeInactive=true").expect(200);
      const ids = res.body.map((p: { id: string }) => p.id);
      expect(ids).not.toContain(patientId);
    });
  });

  // ── 422 blocks for inactive patient ──────────────────────────────────────
  describe("422 business rule — inactive patient blocks creation", () => {
    beforeAll(() => resetPatientActive(false));
    afterAll(() => resetPatientActive(true));

    it("POST /appointments rejects inactive patient with 422", async () => {
      const startsAt = new Date(Date.now() + 86400_000);
      const endsAt = new Date(startsAt.getTime() + 3600_000);
      await as(tokenOwner)
        .post("/appointments", {
          patientId,
          clinicId,
          dentistUserId: ownerId,
          startsAt,
          endsAt,
        })
        .expect(422);
    });

    it("POST /budgets rejects inactive patient with 422", async () => {
      await as(tokenOwner)
        .post("/budgets", { patientId, items: [{ procedureId, value: 100 }] })
        .expect(422);
    });
  });

  // ── Clinic toggle ──────────────────────────────────────────────────────────
  describe("PATCH /clinics/:id/active — clinic toggle", () => {
    beforeEach(() => resetClinicActive(clinicId, true));

    it("ADMIN can deactivate clinic", async () => {
      const res = await as(tokenAdmin).patch(`/clinics/${clinicId}/active`, { active: false }).expect(200);
      expect(res.body.active).toBe(false);
    });

    it("ADMIN can reactivate clinic", async () => {
      await rawPrisma.clinic.update({ where: { id: clinicId }, data: { active: false } });
      const res = await as(tokenAdmin).patch(`/clinics/${clinicId}/active`, { active: true }).expect(200);
      expect(res.body.active).toBe(true);
    });

    it("non-ADMIN gets 403", async () => {
      await as(tokenOwner).patch(`/clinics/${clinicId}/active`, { active: false }).expect(403);
    });

    it("ADMIN of another org gets 404 (IDOR)", async () => {
      await as(tokenAdmin2).patch(`/clinics/${clinicId}/active`, { active: false }).expect(404);
    });

    it("cannot deactivate last active clinic — 409", async () => {
      // deactivate clinic2 so only clinicId remains active
      await rawPrisma.clinic.update({ where: { id: clinic2Id }, data: { active: false } });
      await as(tokenAdmin).patch(`/clinics/${clinicId}/active`, { active: false }).expect(409);
      // restore
      await rawPrisma.clinic.update({ where: { id: clinic2Id }, data: { active: true } });
    });
  });

  // ── Clinic list filter ─────────────────────────────────────────────────────
  describe("GET /clinics — includeInactive filter", () => {
    beforeAll(() => resetClinicActive(clinicId, false));
    afterAll(() => resetClinicActive(clinicId, true));

    it("default list hides inactive clinic", async () => {
      const res = await as(tokenAdmin).get("/clinics").expect(200);
      const ids = res.body.map((c: { id: string }) => c.id);
      expect(ids).not.toContain(clinicId);
    });

    it("ADMIN + includeInactive=true sees inactive clinic", async () => {
      const res = await as(tokenAdmin).get("/clinics?includeInactive=true").expect(200);
      const ids = res.body.map((c: { id: string }) => c.id);
      expect(ids).toContain(clinicId);
    });

    it("non-ADMIN ignores includeInactive", async () => {
      const res = await as(tokenOwner).get("/clinics?includeInactive=true").expect(200);
      const ids = res.body.map((c: { id: string }) => c.id);
      expect(ids).not.toContain(clinicId);
    });
  });

  // ── 422 blocks for inactive clinic ────────────────────────────────────────
  describe("422 business rule — inactive clinic blocks creation", () => {
    beforeAll(() => resetClinicActive(clinicId, false));
    afterAll(() => resetClinicActive(clinicId, true));

    it("POST /appointments rejects inactive clinic with 422", async () => {
      const startsAt = new Date(Date.now() + 86400_000);
      const endsAt = new Date(startsAt.getTime() + 3600_000);
      await as(tokenOwner)
        .post("/appointments", {
          patientId,
          clinicId,
          dentistUserId: ownerId,
          startsAt,
          endsAt,
        })
        .expect(422);
    });
  });

  // ── findOne works for inactive patient (history) ──────────────────────────
  describe("GET /patients/:id — inactive patient still accessible", () => {
    beforeAll(() => resetPatientActive(false));
    afterAll(() => resetPatientActive(true));

    it("ADMIN can still GET inactive patient", async () => {
      const res = await as(tokenAdmin).get(`/patients/${patientId}`).expect(200);
      expect(res.body.active).toBe(false);
    });

    it("OWNER can still GET own inactive patient", async () => {
      const res = await as(tokenOwner).get(`/patients/${patientId}`).expect(200);
      expect(res.body.active).toBe(false);
    });
  });
});
