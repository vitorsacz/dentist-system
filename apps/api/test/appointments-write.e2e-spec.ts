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
// Future time helpers
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
let _slotSeq = 0;
function futureSlot(offsetMs = DAY): { startsAt: string; endsAt: string } {
  const base = Date.now() + offsetMs + (_slotSeq++ * HOUR);
  return {
    startsAt: new Date(base).toISOString(),
    endsAt: new Date(base + 30 * 60 * 1000).toISOString(),
  };
}
let _pastSlotSeq = 0;
function pastSlot(): { startsAt: string; endsAt: string } {
  const base = Date.now() - HOUR - (_pastSlotSeq++ * HOUR);
  return {
    startsAt: new Date(base).toISOString(),
    endsAt: new Date(base + 30 * 60 * 1000).toISOString(),
  };
}

// Personas:
// ADMIN         – plain ADMIN, no DENTIST role
// ADMIN_DENTIST – roles [ADMIN, DENTIST]
// DENTIST_A     – plain DENTIST
// DENTIST_B     – plain DENTIST (different from A)
// DENTIST_INACTIVE – DENTIST but active=false
// RECEPTIONIST
// ADMIN_B       – ADMIN in a separate org (cross-org isolation)

describe("Appointments — escrita (e2e)", () => {
  let app: NestExpressApplication;

  // Org 1
  let orgId: string;
  let adminToken: string;
  let adminId: string;
  let adminDentistToken: string;
  let adminDentistId: string;
  let dentistAToken: string;
  let dentistAId: string;
  let dentistBId: string;
  let dentistInactiveId: string;
  let receptionistToken: string;
  let patientId: string;
  let patientInactiveId: string;
  let clinicId: string;
  let clinicInactiveId: string;

  let dentistRecepToken: string;
  let dentistRecepId: string;

  // Org 2
  let adminBToken: string;

  function as(token: string) {
    const srv = () => app.getHttpServer();
    return {
      get: (url: string) => request(srv()).get(url).set("Authorization", `Bearer ${token}`),
      post: (url: string, body?: object) =>
        request(srv()).post(url).set("Authorization", `Bearer ${token}`).send(body),
      patch: (url: string, body?: object) =>
        request(srv()).patch(url).set("Authorization", `Bearer ${token}`).send(body),
    };
  }

  async function loginAs(email: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ identifier: email, password: TEST_PASSWORD });
    expect(res.status).toBe(200);
    return res.body.accessToken as string;
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
    const org = await rawPrisma.organization.create({ data: { name: "Escrita Org" } });
    orgId = org.id;

    const adminUser = await rawPrisma.user.create({
      data: { organizationId: orgId, email: `wr-admin-${ts}@t.com`, passwordHash: hash, name: "Admin WR", roles: ["ADMIN"] },
    });
    adminId = adminUser.id;
    await rawPrisma.organization.update({ where: { id: orgId }, data: { foundingAdminUserId: adminId } });

    const adminDentistUser = await rawPrisma.user.create({
      data: { organizationId: orgId, email: `wr-admdt-${ts}@t.com`, passwordHash: hash, name: "AdminDentist WR", roles: ["ADMIN", "DENTIST"] },
    });
    adminDentistId = adminDentistUser.id;

    const dentistA = await rawPrisma.user.create({
      data: { organizationId: orgId, email: `wr-da-${ts}@t.com`, passwordHash: hash, name: "DentistA WR", roles: ["DENTIST"] },
    });
    dentistAId = dentistA.id;

    const dentistB = await rawPrisma.user.create({
      data: { organizationId: orgId, email: `wr-db-${ts}@t.com`, passwordHash: hash, name: "DentistB WR", roles: ["DENTIST"] },
    });
    dentistBId = dentistB.id;

    const dentistInactive = await rawPrisma.user.create({
      data: {
        organizationId: orgId,
        email: `wr-di-${ts}@t.com`,
        passwordHash: hash,
        name: "DentistInactive WR",
        roles: ["DENTIST"],
        active: false,
      },
    });
    dentistInactiveId = dentistInactive.id;

    const receptionistUser = await rawPrisma.user.create({
      data: { organizationId: orgId, email: `wr-rec-${ts}@t.com`, passwordHash: hash, name: "Rec WR", roles: ["RECEPTIONIST"] },
    });

    const dentistRecepUser = await rawPrisma.user.create({
      data: { organizationId: orgId, email: `wr-drecep-${ts}@t.com`, passwordHash: hash, name: "DentistRecep WR", roles: ["DENTIST", "RECEPTIONIST"] },
    });
    dentistRecepId = dentistRecepUser.id;

    const patientActive = await rawPrisma.patient.create({
      data: { organizationId: orgId, name: "Patient WR", phone: "11999999001", createdByUserId: dentistAId, ownerDentistId: dentistAId },
    });
    patientId = patientActive.id;

    const patientInactive = await rawPrisma.patient.create({
      data: {
        organizationId: orgId,
        name: "Patient Inactive WR",
        phone: "11999999002",
        createdByUserId: dentistAId,
        ownerDentistId: dentistAId,
        active: false,
      },
    });
    patientInactiveId = patientInactive.id;

    const clinic = await rawPrisma.clinic.create({
      data: { organizationId: orgId, name: "Clinic WR", type: "OWN", colorToken: "BRAND" },
    });
    clinicId = clinic.id;

    const clinicInactive = await rawPrisma.clinic.create({
      data: { organizationId: orgId, name: "Clinic Inactive WR", type: "OWN", colorToken: "SUCCESS", active: false },
    });
    clinicInactiveId = clinicInactive.id;

    // ── Org 2 ──────────────────────────────────────────────────────────────────
    const org2 = await rawPrisma.organization.create({ data: { name: "Escrita Org2" } });

    const adminB = await rawPrisma.user.create({
      data: { organizationId: org2.id, email: `wr-adminb-${ts}@t.com`, passwordHash: hash, name: "AdminB WR", roles: ["ADMIN"] },
    });
    await rawPrisma.organization.update({ where: { id: org2.id }, data: { foundingAdminUserId: adminB.id } });

    // Share patient with dentists so they can be assigned in appointments
    await rawPrisma.patientShare.createMany({
      data: [
        { patientId, dentistId: adminDentistId, organizationId: orgId, sharedById: adminId },
        { patientId, dentistId: dentistBId, organizationId: orgId, sharedById: adminId },
        { patientId, dentistId: dentistRecepId, organizationId: orgId, sharedById: adminId },
      ],
    });
    // Share patient with adminUser doesn't make sense (not DENTIST), but for
    // the "ADMIN without DENTIST as dentistUserId" test we rely on the validate
    // check in the service.

    // ── Tokens ────────────────────────────────────────────────────────────────
    adminToken = await loginAs(adminUser.email);
    adminDentistToken = await loginAs(adminDentistUser.email);
    dentistAToken = await loginAs(dentistA.email);
    await loginAs(dentistB.email); // login establishes session; token unused in tests
    receptionistToken = await loginAs(receptionistUser.email);
    dentistRecepToken = await loginAs(dentistRecepUser.email);
    adminBToken = await loginAs(adminB.email);
  }, 60000);

  afterAll(async () => {
    await teardownAll(rawPrisma);
    await rawPrisma.$disconnect();
    await app.close();
  });

  // ── Helpers ───────────────────────────────────────────────────────────────
  function apptBody(overrides: Partial<{
    patientId: string; clinicId: string; dentistUserId: string;
    startsAt: string; endsAt: string; notes: string; allowOverlap: boolean;
  }> = {}) {
    const slot = futureSlot();
    return {
      patientId,
      clinicId,
      dentistUserId: dentistAId,
      ...slot,
      ...overrides,
    };
  }

  // ── POST /appointments ────────────────────────────────────────────────────
  describe("POST /appointments", () => {
    it("ADMIN cria agendamento → 201", async () => {
      const res = await as(adminToken).post("/appointments", apptBody({ dentistUserId: dentistAId }));
      expect(res.status).toBe(201);
    });

    it("ADMIN_DENTIST agendando para si mesmo → 201", async () => {
      const res = await as(adminDentistToken).post("/appointments", apptBody({ dentistUserId: adminDentistId }));
      expect(res.status).toBe(201);
    });

    it("ADMIN_DENTIST agendando para DENTIST_A → 201 (ADMIN role permite)", async () => {
      const res = await as(adminDentistToken).post("/appointments", apptBody({ dentistUserId: dentistAId }));
      expect(res.status).toBe(201);
    });

    it("ADMIN sem papel DENTIST como dentistUserId → 422", async () => {
      const res = await as(adminToken).post("/appointments", apptBody({ dentistUserId: adminId }));
      expect(res.status).toBe(422);
    });

    it("DENTIST_A com próprio id → 201", async () => {
      const res = await as(dentistAToken).post("/appointments", apptBody({ dentistUserId: dentistAId }));
      expect(res.status).toBe(201);
    });

    it("DENTIST_A com id de DENTIST_B → 403", async () => {
      const res = await as(dentistAToken).post("/appointments", apptBody({ dentistUserId: dentistBId }));
      expect(res.status).toBe(403);
    });

    it("RECEPTIONIST cria → 201", async () => {
      const res = await as(receptionistToken).post("/appointments", apptBody({ dentistUserId: dentistAId }));
      expect(res.status).toBe(201);
    });

    it("Paciente inativo → 422", async () => {
      const res = await as(adminToken).post("/appointments", apptBody({ patientId: patientInactiveId }));
      expect(res.status).toBe(422);
    });

    it("Clínica inativa → 422", async () => {
      const res = await as(adminToken).post("/appointments", apptBody({ clinicId: clinicInactiveId }));
      expect(res.status).toBe(422);
    });

    it("Dentista inativo → 422", async () => {
      const res = await as(adminToken).post("/appointments", apptBody({ dentistUserId: dentistInactiveId }));
      expect(res.status).toBe(422);
    });

    it("endsAt <= startsAt → 400", async () => {
      const base = new Date(Date.now() + DAY).toISOString();
      const res = await as(adminToken).post("/appointments", {
        ...apptBody(),
        startsAt: base,
        endsAt: base,
      });
      expect(res.status).toBe(400);
    });

    it("endsAt - startsAt > 8h → 400", async () => {
      const start = new Date(Date.now() + DAY).toISOString();
      const end = new Date(Date.now() + DAY + 9 * HOUR).toISOString();
      const res = await as(adminToken).post("/appointments", { ...apptBody(), startsAt: start, endsAt: end });
      expect(res.status).toBe(400);
    });

    it("startsAt sem offset (sem timezone) → 400", async () => {
      const res = await as(adminToken).post("/appointments", {
        ...apptBody(),
        startsAt: "2026-10-25T10:00:00",
        endsAt: "2026-10-25T10:30:00",
      });
      expect(res.status).toBe(400);
    });

    it("DENTIST agendar no passado → 422", async () => {
      const slot = pastSlot();
      const res = await as(dentistAToken).post("/appointments", apptBody({ ...slot, dentistUserId: dentistAId }));
      expect(res.status).toBe(422);
    });

    it("ADMIN agendar no passado → 201", async () => {
      const slot = pastSlot();
      const res = await as(adminToken).post("/appointments", apptBody({ ...slot, dentistUserId: dentistAId }));
      expect(res.status).toBe(201);
    });

    it("RECEPTIONIST agendar no passado → 201", async () => {
      const slot = pastSlot();
      const res = await as(receptionistToken).post("/appointments", apptBody({ ...slot, dentistUserId: dentistAId }));
      expect(res.status).toBe(201);
    });

    describe("conflito de horário", () => {
      let conflictSlot: { startsAt: string; endsAt: string };

      beforeAll(async () => {
        // Create a base appointment to conflict against
        const s = new Date(Date.now() + 2 * DAY);
        conflictSlot = {
          startsAt: s.toISOString(),
          endsAt: new Date(s.getTime() + 30 * 60 * 1000).toISOString(),
        };
        const res = await as(adminToken).post("/appointments", apptBody({ ...conflictSlot, dentistUserId: dentistAId }));
        expect(res.status).toBe(201);
      });

      it("conflito sem allowOverlap → 409 com code SCHEDULE_CONFLICT", async () => {
        const res = await as(adminToken).post("/appointments", apptBody({ ...conflictSlot, dentistUserId: dentistAId }));
        expect(res.status).toBe(409);
        expect(res.body.code).toBe("SCHEDULE_CONFLICT");
        expect(Array.isArray(res.body.conflicts)).toBe(true);
        expect(res.body.conflicts.length).toBeGreaterThan(0);
      });

      it("conflito ADMIN allowOverlap: true → 201", async () => {
        const res = await as(adminToken).post("/appointments", {
          ...apptBody({ ...conflictSlot, dentistUserId: dentistAId }),
          allowOverlap: true,
        });
        expect(res.status).toBe(201);
      });

      it("conflito RECEPTIONIST allowOverlap: true → 201", async () => {
        const res = await as(receptionistToken).post("/appointments", {
          ...apptBody({ ...conflictSlot, dentistUserId: dentistAId }),
          allowOverlap: true,
        });
        expect(res.status).toBe(201);
      });

      it("conflito DENTIST allowOverlap: true → 403", async () => {
        const res = await as(dentistAToken).post("/appointments", {
          ...apptBody({ ...conflictSlot, dentistUserId: dentistAId }),
          allowOverlap: true,
        });
        expect(res.status).toBe(403);
      });

      it("CANCELED não conflita — criar sobre slot cancelado → 201", async () => {
        const s = new Date(Date.now() + 3 * DAY);
        const slot = {
          startsAt: s.toISOString(),
          endsAt: new Date(s.getTime() + 30 * 60 * 1000).toISOString(),
        };
        // Create and then cancel it
        const created = await as(adminToken).post("/appointments", apptBody({ ...slot, dentistUserId: dentistAId }));
        expect(created.status).toBe(201);
        const canceled = await as(adminToken).patch(`/appointments/${created.body.id}/cancel`);
        expect(canceled.status).toBe(200);
        // Now create again in same slot — should not conflict
        const again = await as(adminToken).post("/appointments", apptBody({ ...slot, dentistUserId: dentistAId }));
        expect(again.status).toBe(201);
      });

      it("end == start do outro — boundary NÃO conflita → 201", async () => {
        // Create appointment ending at T+4days+00:30
        const base = new Date(Date.now() + 4 * DAY);
        const existing = {
          startsAt: base.toISOString(),
          endsAt: new Date(base.getTime() + 30 * 60 * 1000).toISOString(),
        };
        await as(adminToken).post("/appointments", apptBody({ ...existing, dentistUserId: dentistBId }));
        // Create new appointment starting exactly when existing ends — no conflict
        const adjacent = {
          startsAt: existing.endsAt,
          endsAt: new Date(new Date(existing.endsAt).getTime() + 30 * 60 * 1000).toISOString(),
        };
        const res = await as(adminToken).post("/appointments", apptBody({ ...adjacent, dentistUserId: dentistBId }));
        expect(res.status).toBe(201);
      });
    });

    it("2 POSTs simultâneos mesmo slot: só 1 passa → [201, 409]", async () => {
      const s = new Date(Date.now() + 10 * DAY);
      const slot = {
        startsAt: s.toISOString(),
        endsAt: new Date(s.getTime() + 30 * 60 * 1000).toISOString(),
      };
      const body = apptBody({ ...slot, dentistUserId: dentistAId });
      const [r1, r2] = await Promise.all([
        as(adminToken).post("/appointments", body),
        as(adminToken).post("/appointments", body),
      ]);
      const statuses = [r1.status, r2.status].sort();
      expect(statuses).toEqual([201, 409]);
    });

    it("cross-org: ADMIN_B não pode criar com paciente da org A → 404/422", async () => {
      const res = await as(adminBToken).post("/appointments", {
        ...apptBody(),
        patientId,
      });
      expect([404, 422]).toContain(res.status);
    });
  });

  // ── PATCH /appointments/:id ───────────────────────────────────────────────
  describe("PATCH /appointments/:id", () => {
    let apptId: string;
    let dentistBApptId: string;

    beforeAll(async () => {
      const slot = futureSlot(5 * DAY);
      const r1 = await as(adminToken).post("/appointments", apptBody({ ...slot, dentistUserId: dentistAId }));
      expect(r1.status).toBe(201);
      apptId = r1.body.id;

      const slot2 = futureSlot(6 * DAY);
      const r2 = await as(adminToken).post("/appointments", apptBody({ ...slot2, dentistUserId: dentistBId }));
      expect(r2.status).toBe(201);
      dentistBApptId = r2.body.id;
    });

    it("patientId no body → 400", async () => {
      const res = await as(adminToken).patch(`/appointments/${apptId}`, { patientId, notes: "x" });
      expect(res.status).toBe(400);
    });

    it("DENTIST_A edita próprio agendamento → 200", async () => {
      const res = await as(dentistAToken).patch(`/appointments/${apptId}`, { notes: "editado" });
      expect(res.status).toBe(200);
    });

    it("DENTIST_A acessa agendamento de DENTIST_B → 404", async () => {
      const res = await as(dentistAToken).patch(`/appointments/${dentistBApptId}`, { notes: "tentativa" });
      expect(res.status).toBe(404);
    });

    it("DENTIST_A muda dentistUserId para DENTIST_B → 403", async () => {
      const res = await as(dentistAToken).patch(`/appointments/${apptId}`, { dentistUserId: dentistBId });
      expect(res.status).toBe(403);
    });

    it("DONE: mudar horário → 422", async () => {
      const slot = futureSlot(7 * DAY);
      const created = await as(adminToken).post("/appointments", apptBody({ ...slot, dentistUserId: dentistAId }));
      expect(created.status).toBe(201);
      await rawPrisma.appointment.update({ where: { id: created.body.id }, data: { status: "DONE" } });
      const res = await as(adminToken).patch(`/appointments/${created.body.id}`, { startsAt: futureSlot(8 * DAY).startsAt });
      expect(res.status).toBe(422);
    });

    it("NO_SHOW: mudar status → 422", async () => {
      const slot = futureSlot(9 * DAY);
      const created = await as(adminToken).post("/appointments", apptBody({ ...slot, dentistUserId: dentistAId }));
      expect(created.status).toBe(201);
      await rawPrisma.appointment.update({ where: { id: created.body.id }, data: { status: "NO_SHOW" } });
      const res = await as(adminToken).patch(`/appointments/${created.body.id}`, { status: "SCHEDULED" });
      expect(res.status).toBe(422);
    });

    it("CANCELED→SCHEDULED re-checa conflito: conflito existe → 409", async () => {
      // Create a slot used by another appointment
      const s = new Date(Date.now() + 11 * DAY);
      const slot = { startsAt: s.toISOString(), endsAt: new Date(s.getTime() + 30 * 60 * 1000).toISOString() };

      // create the "blocker" appointment
      const blocker = await as(adminToken).post("/appointments", apptBody({ ...slot, dentistUserId: dentistAId }));
      expect(blocker.status).toBe(201);

      // create, then cancel the "restorer"
      const restorer = await as(adminToken).post("/appointments", apptBody({ ...slot, dentistUserId: dentistAId, allowOverlap: true }));
      expect(restorer.status).toBe(201);
      await as(adminToken).patch(`/appointments/${restorer.body.id}/cancel`);

      // restoring from CANCELED: should detect conflict with blocker
      const res = await as(adminToken).patch(`/appointments/${restorer.body.id}`, { status: "SCHEDULED" });
      expect(res.status).toBe(409);
      expect(res.body.code).toBe("SCHEDULE_CONFLICT");
    });

    it("CANCELED→SCHEDULED sem conflito → 200", async () => {
      const s = new Date(Date.now() + 12 * DAY);
      const slot = { startsAt: s.toISOString(), endsAt: new Date(s.getTime() + 30 * 60 * 1000).toISOString() };
      const created = await as(adminToken).post("/appointments", apptBody({ ...slot, dentistUserId: dentistAId }));
      expect(created.status).toBe(201);
      await as(adminToken).patch(`/appointments/${created.body.id}/cancel`);
      const res = await as(adminToken).patch(`/appointments/${created.body.id}`, { status: "SCHEDULED" });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("SCHEDULED");
    });

    it("allowOverlap DENTIST → 403", async () => {
      const res = await as(dentistAToken).patch(`/appointments/${apptId}`, { allowOverlap: true });
      expect(res.status).toBe(403);
    });

    it("allowOverlap ADMIN bypassa conflito → 200", async () => {
      // apptId slot should have been used before (or we create a new conflict)
      const existing = await rawPrisma.appointment.findUnique({ where: { id: apptId } });
      expect(existing).toBeTruthy();
      const slot = { startsAt: existing!.startsAt.toISOString(), endsAt: existing!.endsAt.toISOString() };
      // create another appointment in same slot
      const second = await as(adminToken).post("/appointments", apptBody({ ...slot, dentistUserId: dentistAId, allowOverlap: true }));
      expect(second.status).toBe(201);
      // update second to same slot again with allowOverlap → 200
      const res = await as(adminToken).patch(`/appointments/${second.body.id}`, {
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        allowOverlap: true,
      });
      expect(res.status).toBe(200);
    });
  });

  // ── PATCH /appointments/:id/cancel ────────────────────────────────────────
  describe("PATCH /appointments/:id/cancel", () => {
    async function makeAppt(dentistId: string, offsetDays = 20): Promise<string> {
      const slot = futureSlot(offsetDays * DAY);
      const res = await as(adminToken).post("/appointments", apptBody({ ...slot, dentistUserId: dentistId }));
      expect(res.status).toBe(201);
      return res.body.id as string;
    }

    it("ADMIN cancela → 200, status CANCELED", async () => {
      const id = await makeAppt(dentistAId, 20);
      const res = await as(adminToken).patch(`/appointments/${id}/cancel`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("CANCELED");
    });

    it("DENTIST_A cancela próprio → 200", async () => {
      const id = await makeAppt(dentistAId, 21);
      const res = await as(dentistAToken).patch(`/appointments/${id}/cancel`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("CANCELED");
    });

    it("DENTIST_A cancela agendamento de DENTIST_B → 404", async () => {
      const id = await makeAppt(dentistBId, 22);
      const res = await as(dentistAToken).patch(`/appointments/${id}/cancel`);
      expect(res.status).toBe(404);
    });

    it("RECEPTIONIST cancela → 200", async () => {
      const id = await makeAppt(dentistAId, 23);
      const res = await as(receptionistToken).patch(`/appointments/${id}/cancel`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("CANCELED");
    });

    it("já CANCELED → 200 idempotente", async () => {
      const id = await makeAppt(dentistAId, 24);
      await as(adminToken).patch(`/appointments/${id}/cancel`);
      const res = await as(adminToken).patch(`/appointments/${id}/cancel`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("CANCELED");
    });

    it("DONE → 422", async () => {
      const id = await makeAppt(dentistAId, 25);
      await rawPrisma.appointment.update({ where: { id }, data: { status: "DONE" } });
      const res = await as(adminToken).patch(`/appointments/${id}/cancel`);
      expect(res.status).toBe(422);
    });

    it("NO_SHOW → 422", async () => {
      const id = await makeAppt(dentistAId, 26);
      await rawPrisma.appointment.update({ where: { id }, data: { status: "NO_SHOW" } });
      const res = await as(adminToken).patch(`/appointments/${id}/cancel`);
      expect(res.status).toBe(422);
    });

    it("cross-org ADMIN_B → 404", async () => {
      const id = await makeAppt(dentistAId, 27);
      const res = await as(adminBToken).patch(`/appointments/${id}/cancel`);
      expect(res.status).toBe(404);
    });
  });

  // ── GET /appointments/:id — findOne scope (Adjustment B) ──────────────────
  describe("GET /appointments/:id — escopo por papel", () => {
    let apptByA: string;
    let apptByB: string;

    beforeAll(async () => {
      const slot1 = futureSlot(30 * DAY);
      const r1 = await as(adminToken).post("/appointments", apptBody({ ...slot1, dentistUserId: dentistAId }));
      expect(r1.status).toBe(201);
      apptByA = r1.body.id;

      const slot2 = futureSlot(31 * DAY);
      const r2 = await as(adminToken).post("/appointments", apptBody({ ...slot2, dentistUserId: dentistBId }));
      expect(r2.status).toBe(201);
      apptByB = r2.body.id;
    });

    it("DENTIST_A acessa próprio agendamento → 200", async () => {
      const res = await as(dentistAToken).get(`/appointments/${apptByA}`);
      expect(res.status).toBe(200);
    });

    it("DENTIST_A acessa agendamento de DENTIST_B → 404", async () => {
      const res = await as(dentistAToken).get(`/appointments/${apptByB}`);
      expect(res.status).toBe(404);
    });

    it("DENTIST+RECEPTIONIST acessa agendamento de outro dentista → 200", async () => {
      const res = await as(dentistRecepToken).get(`/appointments/${apptByA}`);
      expect(res.status).toBe(200);
    });

    it("DENTIST+RECEPTIONIST cancela agendamento de outro dentista → 200", async () => {
      const slot = futureSlot(32 * DAY);
      const created = await as(adminToken).post("/appointments", apptBody({ ...slot, dentistUserId: dentistAId }));
      expect(created.status).toBe(201);
      const res = await as(dentistRecepToken).patch(`/appointments/${created.body.id}/cancel`);
      expect(res.status).toBe(200);
    });

    it("DENTIST+ADMIN acessa agendamento de outro dentista → 200", async () => {
      const res = await as(adminDentistToken).get(`/appointments/${apptByB}`);
      expect(res.status).toBe(200);
    });
  });

  // ── DENTIST_RECEP — permissões de recepção ────────────────────────────────
  describe("DENTIST+RECEPTIONIST — permissões efetivas", () => {
    it("agenda para outro dentista → 201", async () => {
      const res = await as(dentistRecepToken).post("/appointments", apptBody({ dentistUserId: dentistAId }));
      expect(res.status).toBe(201);
    });

    it("agenda para si mesmo → 201", async () => {
      const res = await as(dentistRecepToken).post("/appointments", apptBody({ dentistUserId: dentistRecepId }));
      expect(res.status).toBe(201);
    });

    it("allowOverlap: true → 201", async () => {
      const slot = futureSlot(33 * DAY);
      await as(adminToken).post("/appointments", apptBody({ ...slot, dentistUserId: dentistAId }));
      const res = await as(dentistRecepToken).post("/appointments", {
        ...apptBody({ ...slot, dentistUserId: dentistAId }),
        allowOverlap: true,
      });
      expect(res.status).toBe(201);
    });
  });

  // ── PATCH — regras de tempo com "mudou" (Adjustment A) ───────────────────
  describe("PATCH — regras de tempo só quando valor muda", () => {
    it("DENTIST move startsAt para o passado via PATCH → 422", async () => {
      const slot = futureSlot(34 * DAY);
      const created = await as(adminToken).post("/appointments", apptBody({ ...slot, dentistUserId: dentistAId }));
      expect(created.status).toBe(201);
      const past = pastSlot();
      const res = await as(dentistAToken).patch(`/appointments/${created.body.id}`, { startsAt: past.startsAt });
      expect(res.status).toBe(422);
    });

    it("PATCH só notes em agendamento legado >8h criado direto no DB → 200", async () => {
      const base = new Date(Date.now() + 35 * DAY);
      const legacyAppt = await rawPrisma.appointment.create({
        data: {
          organizationId: (await rawPrisma.organization.findFirst({ where: { name: "Escrita Org" } }))!.id,
          patientId,
          clinicId,
          dentistUserId: dentistAId,
          startsAt: base,
          endsAt: new Date(base.getTime() + 9 * HOUR),
          status: "SCHEDULED",
        },
      });
      const res = await as(adminToken).patch(`/appointments/${legacyAppt.id}`, { notes: "nota legada" });
      expect(res.status).toBe(200);
    });

    it("PATCH com startsAt/endsAt iguais aos atuais + notes em agendamento passado → 200", async () => {
      const pastBase = new Date(Date.now() - 2 * DAY);
      const pastAppt = await rawPrisma.appointment.create({
        data: {
          organizationId: (await rawPrisma.organization.findFirst({ where: { name: "Escrita Org" } }))!.id,
          patientId,
          clinicId,
          dentistUserId: dentistAId,
          startsAt: pastBase,
          endsAt: new Date(pastBase.getTime() + 30 * 60 * 1000),
          status: "SCHEDULED",
        },
      });
      const res = await as(adminToken).patch(`/appointments/${pastAppt.id}`, {
        startsAt: pastBase.toISOString(),
        endsAt: new Date(pastBase.getTime() + 30 * 60 * 1000).toISOString(),
        notes: "sem mudança de horário",
      });
      expect(res.status).toBe(200);
    });

    it("PATCH próprio agendamento mudando horário sem conflito → 200 (excludeId funciona)", async () => {
      const slot = futureSlot(36 * DAY);
      const created = await as(adminToken).post("/appointments", apptBody({ ...slot, dentistUserId: dentistAId }));
      expect(created.status).toBe(201);
      const newSlot = futureSlot(37 * DAY);
      const res = await as(dentistAToken).patch(`/appointments/${created.body.id}`, {
        startsAt: newSlot.startsAt,
        endsAt: newSlot.endsAt,
      });
      expect(res.status).toBe(200);
    });
  });

  // ── Concorrência PATCH (Adjustment C) ────────────────────────────────────
  describe("PATCH concorrência — dois agendamentos diferentes para mesmo horário", () => {
    it("dois PATCHes de agendamentos diferentes do mesmo dentista para mesmo horário → [200, 409]", async () => {
      const slotA = futureSlot(38 * DAY);
      const slotB = futureSlot(39 * DAY);
      const target = futureSlot(40 * DAY);

      const [r1, r2] = await Promise.all([
        as(adminToken).post("/appointments", apptBody({ ...slotA, dentistUserId: dentistAId })),
        as(adminToken).post("/appointments", apptBody({ ...slotB, dentistUserId: dentistAId })),
      ]);
      expect(r1.status).toBe(201);
      expect(r2.status).toBe(201);

      const [p1, p2] = await Promise.all([
        as(adminToken).patch(`/appointments/${r1.body.id}`, { startsAt: target.startsAt, endsAt: target.endsAt }),
        as(adminToken).patch(`/appointments/${r2.body.id}`, { startsAt: target.startsAt, endsAt: target.endsAt }),
      ]);
      const statuses = [p1.status, p2.status].sort();
      expect(statuses).toEqual([200, 409]);
    });
  });
});
