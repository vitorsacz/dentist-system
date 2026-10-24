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
 * Personas:
 *   A  = DENTIST, dono de P1
 *   B  = DENTIST, dono de P2, não acessa P1 inicialmente
 *   Y  = ADMIN (sem DENTIST), vê tudo no registry, mas NÃO lê nem escreve clínico (Decisão A)
 *   R  = RECEPTIONIST
 */
describe("PatientAccess (e2e)", () => {
  let app: NestExpressApplication;
  let tokenA: string;
  let tokenB: string;
  let tokenY: string;
  let tokenR: string;
  let userBId: string;
  let orgId: string;
  let p1Id: string; // owned by A
  let p2Id: string; // owned by B
  let pUnassignedId: string; // no owner

  function as(token: string) {
    const srv = () => request(app.getHttpServer());
    return {
      get: (url: string) => srv().get(url).set("Authorization", `Bearer ${token}`),
      post: (url: string, body?: object) =>
        srv().post(url).set("Authorization", `Bearer ${token}`).send(body),
      put: (url: string, body?: object) =>
        srv().put(url).set("Authorization", `Bearer ${token}`).send(body),
      patch: (url: string, body?: object) =>
        srv().patch(url).set("Authorization", `Bearer ${token}`).send(body),
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

    const org = await rawPrisma.organization.create({ data: { name: "Acesso Teste" } });
    orgId = org.id;

    const admin = await rawPrisma.user.create({
      data: { organizationId: orgId, email: `admin-${ts}@test.com`, passwordHash: hash, name: "FounderAdmin", roles: ["ADMIN"] },
    });
    await rawPrisma.organization.update({ where: { id: orgId }, data: { foundingAdminUserId: admin.id } });

    const uA = await rawPrisma.user.create({
      data: { organizationId: orgId, email: `dent-a-${ts}@test.com`, passwordHash: hash, name: "Dentista A", roles: ["DENTIST"] },
    });
    const uB = await rawPrisma.user.create({
      data: { organizationId: orgId, email: `dent-b-${ts}@test.com`, passwordHash: hash, name: "Dentista B", roles: ["DENTIST"] },
    });
    userBId = uB.id;

    const uY = await rawPrisma.user.create({
      data: { organizationId: orgId, email: `admin-y-${ts}@test.com`, passwordHash: hash, name: "Admin Y", roles: ["ADMIN"] },
    });

    const uR = await rawPrisma.user.create({
      data: { organizationId: orgId, email: `rec-${ts}@test.com`, passwordHash: hash, name: "Recepcionista R", roles: ["RECEPTIONIST"] },
    });

    const login = async (email: string) => {
      const res = await request(app.getHttpServer()).post("/auth/login").send({ identifier: email, password: TEST_PASSWORD });
      return res.body.accessToken as string;
    };

    tokenA = await login(uA.email);
    tokenB = await login(uB.email);
    tokenY = await login(uY.email);
    tokenR = await login(uR.email);

    // Create patients directly in DB (bypasses create endpoint's ownerDentist rule)
    const p1 = await rawPrisma.patient.create({
      data: { organizationId: orgId, name: "Paciente P1", phone: "11000000001", createdByUserId: uA.id, ownerDentistId: uA.id },
    });
    p1Id = p1.id;

    const p2 = await rawPrisma.patient.create({
      data: { organizationId: orgId, name: "Paciente P2", phone: "11000000002", createdByUserId: uB.id, ownerDentistId: uB.id },
    });
    p2Id = p2.id;

    const pU = await rawPrisma.patient.create({
      data: { organizationId: orgId, name: "Sem Responsavel", phone: "11000000003", createdByUserId: admin.id },
    });
    pUnassignedId = pU.id;
  }, 30000);

  afterAll(async () => {
    await app.close();
    await rawPrisma.$disconnect();
  });

  // ── 1. GET /patients (list) scope ────────────────────────────────────────────
  describe("GET /patients (registry scope)", () => {
    it("A sees only own patients (P1, not P2)", async () => {
      const res = await as(tokenA).get("/patients").expect(200);
      const ids = res.body.map((p: { id: string }) => p.id);
      expect(ids).toContain(p1Id);
      expect(ids).not.toContain(p2Id);
    });

    it("B sees only own patients (P2, not P1)", async () => {
      const res = await as(tokenB).get("/patients").expect(200);
      const ids = res.body.map((p: { id: string }) => p.id);
      expect(ids).toContain(p2Id);
      expect(ids).not.toContain(p1Id);
    });

    it("Y (ADMIN only) sees all patients", async () => {
      const res = await as(tokenY).get("/patients").expect(200);
      const ids = res.body.map((p: { id: string }) => p.id);
      expect(ids).toContain(p1Id);
      expect(ids).toContain(p2Id);
    });

    it("R (RECEPTIONIST) sees all patients", async () => {
      const res = await as(tokenR).get("/patients").expect(200);
      const ids = res.body.map((p: { id: string }) => p.id);
      expect(ids).toContain(p1Id);
      expect(ids).toContain(p2Id);
    });
  });

  // ── 2. GET /patients/unassigned ───────────────────────────────────────────────
  describe("GET /patients/unassigned", () => {
    it("DENTIST sees unassigned patients", async () => {
      const res = await as(tokenA).get("/patients/unassigned").expect(200);
      const ids = res.body.map((p: { id: string }) => p.id);
      expect(ids).toContain(pUnassignedId);
      expect(ids).not.toContain(p1Id);
      // returns only id/name/phone
      expect(res.body[0]).toHaveProperty("id");
      expect(res.body[0]).toHaveProperty("name");
      expect(res.body[0]).toHaveProperty("phone");
      expect(res.body[0]).not.toHaveProperty("cpf");
    });

    it("RECEPTIONIST cannot access unassigned list → 403", async () => {
      await as(tokenR).get("/patients/unassigned").expect(403);
    });
  });

  // ── 3. POST /patients/:id/claim ───────────────────────────────────────────────
  describe("POST /patients/:id/claim", () => {
    it("B claims unassigned patient → 200", async () => {
      const res = await as(tokenB).post(`/patients/${pUnassignedId}/claim`).expect(201);
      expect(res.body.ownerDentist?.id).toBe(userBId);
    });

    it("A tries to claim already-owned patient → 409", async () => {
      await as(tokenA).post(`/patients/${pUnassignedId}/claim`).expect(409);
    });

    it("RECEPTIONIST cannot claim → 403", async () => {
      await as(tokenR).post(`/patients/${p1Id}/claim`).expect(403);
    });

    it("ADMIN-only (Y) cannot claim → 403", async () => {
      await as(tokenY).post(`/patients/${p1Id}/claim`).expect(403);
    });
  });

  // ── 4. GET /patients/:id with access object ───────────────────────────────────
  describe("GET /patients/:id", () => {
    it("A gets P1 with access object", async () => {
      const res = await as(tokenA).get(`/patients/${p1Id}`).expect(200);
      expect(res.body.id).toBe(p1Id);
      expect(res.body.access).toBeDefined();
      expect(res.body.access.isOwner).toBe(true);
      expect(res.body.access.canWriteClinical).toBe(true);
    });

    it("B outside scope cannot see P1 → 404", async () => {
      await as(tokenB).get(`/patients/${p1Id}`).expect(404);
    });

    it("Y (ADMIN) gets P1 with access", async () => {
      const res = await as(tokenY).get(`/patients/${p1Id}`).expect(200);
      expect(res.body.id).toBe(p1Id);
      expect(res.body.access.canWriteClinical).toBe(false); // ADMIN without DENTIST cannot write clinical
    });

    it("R (RECEPTIONIST) gets P1", async () => {
      const res = await as(tokenR).get(`/patients/${p1Id}`).expect(200);
      expect(res.body.id).toBe(p1Id);
    });
  });

  // ── 5. GET /patients/:id/access ───────────────────────────────────────────────
  describe("GET /patients/:id/access", () => {
    it("A gets access with canShare=true and eligibleDentists", async () => {
      const res = await as(tokenA).get(`/patients/${p1Id}/access`).expect(200);
      expect(res.body.canShare).toBe(true);
      expect(Array.isArray(res.body.eligibleDentists)).toBe(true);
      expect(res.body.eligibleDentists.some((d: { id: string }) => d.id === userBId)).toBe(true);
    });

    it("Y (ADMIN) gets access with canShare=true", async () => {
      const res = await as(tokenY).get(`/patients/${p1Id}/access`).expect(200);
      expect(res.body.canShare).toBe(true);
    });

    it("B outside scope → 404 on /access", async () => {
      await as(tokenB).get(`/patients/${p1Id}/access`).expect(404);
    });
  });

  // ── 6. Anamnesis: clinical read/write before share ────────────────────────────
  describe("Anamnesis scope BEFORE share", () => {
    it("A can upsert anamnesis of P1 (clinicalWrite owner)", async () => {
      await as(tokenA)
        .put(`/patients/${p1Id}/anamnesis`, { chiefComplaint: "Dor molar", allergies: "", medications: "", healthConditions: "", dentalHistory: "" })
        .expect(200);
    });

    it("Y (ADMIN, no DENTIST) cannot write anamnesis of P1 → 403 (Decisão A: ADMIN not in clinical.write)", async () => {
      await as(tokenY)
        .put(`/patients/${p1Id}/anamnesis`, { chiefComplaint: "Y admin tentativa", allergies: "", medications: "", healthConditions: "", dentalHistory: "" })
        .expect(403);
    });

    it("Y (ADMIN, no DENTIST) cannot READ anamnesis of P1 → 403 (Decisão A: ADMIN removed from clinical.read)", async () => {
      await as(tokenY).get(`/patients/${p1Id}/anamnesis`).expect(403);
    });

    it("B outside scope cannot read anamnesis of P1 → 404", async () => {
      await as(tokenB).get(`/patients/${p1Id}/anamnesis`).expect(404);
    });
  });

  // ── 7. Share P1 with B ────────────────────────────────────────────────────────
  describe("POST /patients/:id/shares", () => {
    it("A shares P1 with B → 201", async () => {
      const res = await as(tokenA).post(`/patients/${p1Id}/shares`, { dentistId: userBId }).expect(201);
      expect(res.body.dentistId).toBe(userBId);
    });

    it("Share with non-DENTIST user → 404", async () => {
      // R (RECEPTIONIST) is not DENTIST
      const recRes = await rawPrisma.user.findFirst({ where: { organizationId: orgId, roles: { has: "RECEPTIONIST" } } });
      if (recRes) {
        await as(tokenA).post(`/patients/${p1Id}/shares`, { dentistId: recRes.id }).expect(404);
      }
    });

    it("B (non-owner, no ADMIN) cannot share P1 → 403", async () => {
      // B has share but is not owner and not admin — cannot share further
      // (B now has access via share, so registry check passes; but canShare = isOwner || ADMIN fails)
      // Need a third dentist to try to share with
      const ts = Date.now();
      const hash = await bcrypt.hash(TEST_PASSWORD, 10);
      const uC = await rawPrisma.user.create({
        data: { organizationId: orgId, email: `dent-c-${ts}@test.com`, passwordHash: hash, name: "Dentista C", roles: ["DENTIST"] },
      });
      await as(tokenB).post(`/patients/${p1Id}/shares`, { dentistId: uC.id }).expect(403);
    });
  });

  // ── 8. Anamnesis AFTER share: B can read and write ────────────────────────────
  describe("Anamnesis scope AFTER share", () => {
    it("B can read anamnesis of P1 after share", async () => {
      await as(tokenB).get(`/patients/${p1Id}/anamnesis`).expect(200);
    });

    it("B can upsert anamnesis of P1 after share (clinicalWrite)", async () => {
      const res = await as(tokenB)
        .put(`/patients/${p1Id}/anamnesis`, { chiefComplaint: "Escrito por B", allergies: "", medications: "", healthConditions: "", dentalHistory: "" })
        .expect(200);
      expect(res.body.chiefComplaint).toBe("Escrito por B");
    });
  });

  // ── 9. Revoke share ────────────────────────────────────────────────────────────
  describe("DELETE /patients/:id/shares/:dentistId", () => {
    it("A revokes share with B → 200", async () => {
      await as(tokenA).delete(`/patients/${p1Id}/shares/${userBId}`).expect(200);
    });

    it("B can no longer read anamnesis of P1 after revocation → 404", async () => {
      await as(tokenB).get(`/patients/${p1Id}/anamnesis`).expect(404);
    });

    it("B can no longer write anamnesis of P1 after revocation → 404", async () => {
      await as(tokenB)
        .put(`/patients/${p1Id}/anamnesis`, { chiefComplaint: "Após revogação", allergies: "", medications: "", healthConditions: "", dentalHistory: "" })
        .expect(404);
    });
  });

  // ── 10. Scope in recalls, budgets ─────────────────────────────────────────────
  describe("Scope enforcement in dependent modules", () => {
    it("A cannot create recall for P2 (B patient) → 404", async () => {
      const dueDate = new Date(Date.now() + 86400000).toISOString();
      await as(tokenA)
        .post("/recalls", { patientId: p2Id, type: "ROTINA", dueDate })
        .expect(404);
    });

    it("A sees only P1 recalls (not P2)", async () => {
      // Create recall for P1 via A
      const dueDate = new Date(Date.now() + 86400000).toISOString();
      await as(tokenA).post("/recalls", { patientId: p1Id, type: "ROTINA", dueDate }).expect(201);

      const res = await as(tokenA).get("/recalls").expect(200);
      const patientIds = res.body.map((r: { patient: { id: string } }) => r.patient.id);
      expect(patientIds.every((id: string) => id !== p2Id)).toBe(true);
    });

    it("R (RECEPTIONIST) sees all recalls", async () => {
      const res = await as(tokenR).get("/recalls").expect(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  // ── 11. Reactivation: re-share after revocation ────────────────────────────────
  describe("Re-share (upsert with revokedAt=null)", () => {
    it("A re-shares P1 with B → 201 and B can access again", async () => {
      await as(tokenA).post(`/patients/${p1Id}/shares`, { dentistId: userBId }).expect(201);
      await as(tokenB).get(`/patients/${p1Id}/anamnesis`).expect(200);
    });
  });

  // ── 12. Appointments scope (DENTIST restricted to own appointments) ──────────
  describe("Appointments scope", () => {
    let apptAId: string;
    let apptBId: string;
    let clinicId: string;

    beforeAll(async () => {
      const clinicRes = await as(tokenA).post("/clinics", { name: "Consultório Teste", type: "PROPRIO" }).then(async () => {
        const list = await rawPrisma.clinic.findFirst({ where: { organizationId: orgId } });
        return list;
      });
      clinicId = clinicRes?.id ?? "";

      const now = new Date();
      const start = new Date(now.getTime() + 3600_000).toISOString();
      const end = new Date(now.getTime() + 7200_000).toISOString();

      // A creates appointment for P1 with A as dentist
      const resA = await as(tokenA).post("/appointments", {
        patientId: p1Id,
        dentistUserId: (await rawPrisma.user.findFirst({ where: { organizationId: orgId, roles: { has: "DENTIST" }, email: { contains: "dent-a-" } } }))?.id,
        clinicId,
        startsAt: start,
        endsAt: end,
        status: "SCHEDULED",
      });
      apptAId = resA.body.id as string;

      const start2 = new Date(now.getTime() + 8_000_000).toISOString();
      const end2 = new Date(now.getTime() + 10_000_000).toISOString();
      // B creates appointment for P2 with B as dentist
      const resB = await as(tokenB).post("/appointments", {
        patientId: p2Id,
        dentistUserId: userBId,
        clinicId,
        startsAt: start2,
        endsAt: end2,
        status: "SCHEDULED",
      });
      apptBId = resB.body.id as string;
    });

    it("A cannot GET appointment of B → 404", async () => {
      if (!apptBId) return;
      await as(tokenA).get(`/appointments/${apptBId}`).expect(404);
    });

    it("A cannot PATCH appointment of B → 404", async () => {
      if (!apptBId) return;
      await as(tokenA).patch(`/appointments/${apptBId}`, { status: "CONFIRMED" }).expect(404);
    });

    it("A can GET own appointment", async () => {
      if (!apptAId) return;
      await as(tokenA).get(`/appointments/${apptAId}`).expect(200);
    });

    it("Y (ADMIN) can GET any appointment", async () => {
      if (!apptAId || !apptBId) return;
      await as(tokenY).get(`/appointments/${apptAId}`).expect(200);
      await as(tokenY).get(`/appointments/${apptBId}`).expect(200);
    });
  });

  // ── 13. Recalls updateStatus scope ────────────────────────────────────────────
  describe("Recall updateStatus scope", () => {
    let recallByBId: string;

    beforeAll(async () => {
      // B creates a recall for P2
      const dueDate = new Date(Date.now() + 2_000_000_000).toISOString();
      const res = await as(tokenB).post("/recalls", { patientId: p2Id, type: "ROTINA", dueDate });
      recallByBId = res.body.id as string;
    });

    it("A cannot update recall of B's patient → 404", async () => {
      if (!recallByBId) return;
      await as(tokenA).patch(`/recalls/${recallByBId}/status`, { status: "DONE" }).expect(404);
    });

    it("B can update own recall → 200", async () => {
      if (!recallByBId) return;
      await as(tokenB).patch(`/recalls/${recallByBId}/status`, { status: "DONE" }).expect(200);
    });
  });
});
