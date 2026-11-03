import request from "supertest";
import { Test } from "@nestjs/testing";
import type { NestExpressApplication } from "@nestjs/platform-express";
import * as bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";
import { TEST_DATABASE_URL } from "./test-db";
import { teardownAll } from "./helpers/teardown";

// A1: DENTIST só registra atendimento para si
// F1: DENTIST vê só o próprio financeiro em attendances.listByPatient
// Isolamento: 2 orgs não vazam dados entre si

const rawPrisma = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } });
const TEST_PASSWORD = "SenhaForte12345";

describe("Attendances (e2e)", () => {
  let app: NestExpressApplication;

  // Org 1 — CLINIC
  let orgId: string;
  let dentistAToken: string;
  let dentistAId: string;
  let dentistBToken: string;
  let dentistBId: string;
  let patientId: string;
  let clinicId: string;
  let procedureId: string;

  // Org 2 — CLINIC (isolamento)
  let dentistCToken: string;
  let dentistCId: string;
  let patientOrg2Id: string;

  function as(token: string) {
    const srv = () => app.getHttpServer();
    return {
      get: (url: string) => request(srv()).get(url).set("Authorization", `Bearer ${token}`),
      post: (url: string, body?: object) =>
        request(srv()).post(url).set("Authorization", `Bearer ${token}`).send(body),
    };
  }

  async function loginAs(email: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ identifier: email, password: TEST_PASSWORD });
    expect(res.status).toBe(200);
    return res.body.accessToken as string;
  }

  function attendanceBody(overrides: Record<string, unknown> = {}) {
    return {
      patientId,
      clinicId,
      procedureId,
      date: new Date().toISOString(),
      grossValue: 200,
      repassePercentage: 50,
      materialCost: 10,
      materialUsages: [],
      ...overrides,
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

    // ── Org 1 ─────────────────────────────────────────────────────────────────
    const org = await rawPrisma.organization.create({ data: { name: `Atend Org1 ${ts}`, type: "CLINIC" } });
    orgId = org.id;

    const dentistA = await rawPrisma.user.create({
      data: { organizationId: orgId, email: `atnd-da-${ts}@t.com`, passwordHash: hash, name: "DentistA Atnd", roles: ["DENTIST"] },
    });
    dentistAId = dentistA.id;
    await rawPrisma.organization.update({ where: { id: orgId }, data: { foundingAdminUserId: dentistAId } });

    const dentistB = await rawPrisma.user.create({
      data: { organizationId: orgId, email: `atnd-db-${ts}@t.com`, passwordHash: hash, name: "DentistB Atnd", roles: ["DENTIST"] },
    });
    dentistBId = dentistB.id;

    const procedure = await rawPrisma.procedureCatalog.create({
      data: { organizationId: orgId, name: "Consulta Atnd", defaultValue: 200 },
    });
    procedureId = procedure.id;

    const clinic = await rawPrisma.clinic.create({
      data: { organizationId: orgId, name: "Clinic Atnd", type: "OWN", colorToken: "BRAND" },
    });
    clinicId = clinic.id;

    const patient = await rawPrisma.patient.create({
      data: { organizationId: orgId, name: "Patient Atnd", phone: "11900000001", createdByUserId: dentistAId, ownerDentistId: dentistAId },
    });
    patientId = patient.id;

    // Share patient with dentistB so both can create attendances for it
    await rawPrisma.patientShare.create({
      data: { patientId, dentistId: dentistBId, organizationId: orgId, sharedById: dentistAId },
    });

    // ── Org 2 ─────────────────────────────────────────────────────────────────
    const org2 = await rawPrisma.organization.create({ data: { name: `Atend Org2 ${ts}`, type: "CLINIC" } });

    const dentistC = await rawPrisma.user.create({
      data: { organizationId: org2.id, email: `atnd-dc-${ts}@t.com`, passwordHash: hash, name: "DentistC Atnd", roles: ["DENTIST"] },
    });
    dentistCId = dentistC.id;
    await rawPrisma.organization.update({ where: { id: org2.id }, data: { foundingAdminUserId: dentistCId } });

    const patientOrg2 = await rawPrisma.patient.create({
      data: { organizationId: org2.id, name: "Patient Org2 Atnd", phone: "11900000002", createdByUserId: dentistCId, ownerDentistId: dentistCId },
    });
    patientOrg2Id = patientOrg2.id;

    // ── Tokens ────────────────────────────────────────────────────────────────
    dentistAToken = await loginAs(dentistA.email);
    dentistBToken = await loginAs(dentistB.email);
    dentistCToken = await loginAs(dentistC.email);
  }, 60000);

  afterAll(async () => {
    await app.close();
    await rawPrisma.$disconnect();
  });

  // ── POST /attendances ──────────────────────────────────────────────────────

  describe("POST /attendances", () => {
    it("DENTIST cria atendimento para si → 201 com dentistUserId = actor.id", async () => {
      const res = await as(dentistAToken).post("/attendances", attendanceBody());
      expect(res.status).toBe(201);
      expect(res.body.dentistUserId).toBe(dentistAId);
    });

    it("DENTIST sem token → 401", async () => {
      const res = await request(app.getHttpServer()).post("/attendances").send(attendanceBody());
      expect(res.status).toBe(401);
    });

    // A1: agendamento de outro dentista não pode ser linkado
    it("A1: DENTIST_A não pode linkar agendamento de DENTIST_B → 403", async () => {
      // Cria agendamento para dentistB via rawPrisma
      const procedure2 = await rawPrisma.procedureCatalog.create({
        data: { organizationId: orgId, name: "Consulta Atnd B", defaultValue: 150 },
      });
      const appt = await rawPrisma.appointment.create({
        data: {
          organizationId: orgId,
          patientId,
          clinicId,
          dentistUserId: dentistBId,
          startsAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
          endsAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
        },
      });
      const res = await as(dentistAToken).post(
        "/attendances",
        attendanceBody({ appointmentId: appt.id, procedureId: procedure2.id }),
      );
      expect(res.status).toBe(403);
    });

    it("A1: DENTIST_A pode linkar o próprio agendamento → 201", async () => {
      const appt = await rawPrisma.appointment.create({
        data: {
          organizationId: orgId,
          patientId,
          clinicId,
          dentistUserId: dentistAId,
          startsAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
          endsAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
        },
      });
      const res = await as(dentistAToken).post(
        "/attendances",
        attendanceBody({ appointmentId: appt.id }),
      );
      expect(res.status).toBe(201);
    });

    // Isolamento: DENTIST_A não pode criar atendimento para paciente de Org2
    it("isolamento: DENTIST_A não acessa paciente de outra org → 403 ou 404", async () => {
      const org2Clinic = await rawPrisma.clinic.create({
        data: { organizationId: (await rawPrisma.patient.findUniqueOrThrow({ where: { id: patientOrg2Id } })).organizationId, name: "Clinic Org2 Atnd", type: "OWN", colorToken: "INFO" },
      });
      const res = await as(dentistAToken).post(
        "/attendances",
        attendanceBody({ patientId: patientOrg2Id, clinicId: org2Clinic.id }),
      );
      expect([403, 404]).toContain(res.status);
    });
  });

  // ── GET /attendances?patientId= ────────────────────────────────────────────

  describe("GET /attendances", () => {
    // F1: DENTIST vê só os próprios atendimentos
    it("F1: DENTIST_A vê apenas os próprios atendimentos do paciente", async () => {
      // Seed: um atendimento de dentistA e um de dentistB para o mesmo paciente
      await rawPrisma.attendance.create({
        data: {
          organizationId: orgId,
          patientId,
          clinicId,
          procedureId,
          date: new Date(),
          grossValue: 100,
          repassePercentage: 50,
          materialCost: 0,
          createdByUserId: dentistAId,
          dentistUserId: dentistAId,
        },
      });
      await rawPrisma.attendance.create({
        data: {
          organizationId: orgId,
          patientId,
          clinicId,
          procedureId,
          date: new Date(),
          grossValue: 200,
          repassePercentage: 50,
          materialCost: 0,
          createdByUserId: dentistBId,
          dentistUserId: dentistBId,
        },
      });

      const res = await as(dentistAToken).get(`/attendances?patientId=${patientId}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      for (const att of res.body) {
        expect(att.dentistUserId).toBe(dentistAId);
      }
    });

    it("isolamento: DENTIST_C não vê atendimentos da Org1", async () => {
      const res = await as(dentistCToken).get(`/attendances?patientId=${patientId}`);
      // Paciente não pertence à org do dentistC → 403 ou lista vazia
      expect([403, 404, 200]).toContain(res.status);
      if (res.status === 200) {
        expect(res.body).toHaveLength(0);
      }
    });
  });
});
