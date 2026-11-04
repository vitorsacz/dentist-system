import request from "supertest";
import { Test } from "@nestjs/testing";
import type { NestExpressApplication } from "@nestjs/platform-express";
import * as bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";
import { TEST_DATABASE_URL } from "./test-db";
import { teardownAll } from "./helpers/teardown";

// materialByDentist=true → sem baixa de estoque, materialCost=0 no relatório
// materialByDentist=false (default) → baixa normal, materialCost real no relatório
// Isolamento: 2 orgs

const rawPrisma = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } });
const TEST_PASSWORD = "SenhaForte12345";

describe("Attendance materialByDentist (e2e)", () => {
  let app: NestExpressApplication;

  let dentistAToken: string;
  let dentistAId: string;
  let orgId: string;
  let patientId: string;
  let clinicId: string;
  let procedureId: string;
  let materialId: string;
  let batchId: string;

  // Org 2
  let dentistBToken: string;
  let patientOrg2Id: string;
  let clinicOrg2Id: string;
  let procedureOrg2Id: string;

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
      date: "2026-06-15T12:00:00.000Z",
      grossValue: 300,
      repassePercentage: 50,
      materialCost: 40,
      materialUsages: [],
      ...overrides,
    };
  }

  function reportUrl(from: string, to: string) {
    return `/reports/financial?from=${from}&to=${to}`;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.init();

    await teardownAll(rawPrisma);

    const hash = await bcrypt.hash(TEST_PASSWORD, 10);
    const ts = Date.now();

    // ── Org 1 — CLINIC ────────────────────────────────────────────────────────
    const org = await rawPrisma.organization.create({ data: { name: `MBD Org1 ${ts}`, type: "CLINIC" } });
    orgId = org.id;

    const dentistA = await rawPrisma.user.create({
      data: { organizationId: orgId, email: `mbd-da-${ts}@t.com`, passwordHash: hash, name: "DA MBD", roles: ["DENTIST"] },
    });
    dentistAId = dentistA.id;
    await rawPrisma.organization.update({ where: { id: orgId }, data: { foundingAdminUserId: dentistAId } });

    const procedure = await rawPrisma.procedureCatalog.create({
      data: { organizationId: orgId, name: "Proc MBD", defaultValue: 300 },
    });
    procedureId = procedure.id;

    const clinic = await rawPrisma.clinic.create({
      data: { organizationId: orgId, name: "Clinic MBD", type: "OWN", colorToken: "BRAND" },
    });
    clinicId = clinic.id;

    const patient = await rawPrisma.patient.create({
      data: { organizationId: orgId, name: "Patient MBD", phone: "11900000010", createdByUserId: dentistAId, ownerDentistId: dentistAId },
    });
    patientId = patient.id;

    const material = await rawPrisma.material.create({
      data: { organizationId: orgId, name: "Resina MBD", unit: "g", minimumStock: 0 },
    });
    materialId = material.id;

    const batch = await rawPrisma.materialBatch.create({
      data: { organizationId: orgId, materialId, quantity: 100, receivedAt: new Date("2026-01-01") },
    });
    batchId = batch.id;

    // ── Org 2 — CLINIC ────────────────────────────────────────────────────────
    const org2 = await rawPrisma.organization.create({ data: { name: `MBD Org2 ${ts}`, type: "CLINIC" } });

    const dentistB = await rawPrisma.user.create({
      data: { organizationId: org2.id, email: `mbd-db-${ts}@t.com`, passwordHash: hash, name: "DB MBD", roles: ["DENTIST"] },
    });
    await rawPrisma.organization.update({ where: { id: org2.id }, data: { foundingAdminUserId: dentistB.id } });

    const procedureOrg2 = await rawPrisma.procedureCatalog.create({
      data: { organizationId: org2.id, name: "Proc MBD Org2", defaultValue: 200 },
    });
    procedureOrg2Id = procedureOrg2.id;

    const clinicOrg2 = await rawPrisma.clinic.create({
      data: { organizationId: org2.id, name: "Clinic MBD Org2", type: "OWN", colorToken: "BRAND" },
    });
    clinicOrg2Id = clinicOrg2.id;

    const patientOrg2 = await rawPrisma.patient.create({
      data: { organizationId: org2.id, name: "Patient MBD Org2", phone: "11900000011", createdByUserId: dentistB.id, ownerDentistId: dentistB.id },
    });
    patientOrg2Id = patientOrg2.id;

    dentistAToken = await loginAs(dentistA.email);
    dentistBToken = await loginAs(dentistB.email);
  }, 60000);

  afterAll(async () => {
    await app.close();
    await rawPrisma.$disconnect();
  });

  // ── POST /attendances ──────────────────────────────────────────────────────

  describe("materialByDentist=false (default)", () => {
    it("cria atendimento e deduz estoque → batch.quantity decresce", async () => {
      const before = await rawPrisma.materialBatch.findUniqueOrThrow({ where: { id: batchId } });

      const res = await as(dentistAToken).post("/attendances", attendanceBody({
        materialUsages: [{ materialId, quantity: 10 }],
      }));
      expect(res.status).toBe(201);

      const after = await rawPrisma.materialBatch.findUniqueOrThrow({ where: { id: batchId } });
      expect(Number(after.quantity)).toBe(Number(before.quantity) - 10);
    });

    it("relatório inclui materialCost real", async () => {
      const res = await as(dentistAToken).get(reportUrl("2026-06-01T00:00:00.000Z", "2026-06-30T23:59:59.000Z"));
      expect(res.status).toBe(200);
      const clinic = res.body.clinics[0];
      expect(clinic.materialCost).toBe(40);
    });
  });

  describe("materialByDentist=true", () => {
    it("cria atendimento SEM deduzir estoque → batch.quantity inalterado", async () => {
      const before = await rawPrisma.materialBatch.findUniqueOrThrow({ where: { id: batchId } });

      const res = await as(dentistAToken).post("/attendances", attendanceBody({
        date: "2026-07-10T12:00:00.000Z",
        materialByDentist: true,
        materialUsages: [{ materialId, quantity: 20 }],
      }));
      expect(res.status).toBe(201);
      expect(res.body.materialByDentist).toBe(true);

      const after = await rawPrisma.materialBatch.findUniqueOrThrow({ where: { id: batchId } });
      expect(Number(after.quantity)).toBe(Number(before.quantity));
    });

    it("relatório: materialCost=0 quando materialByDentist=true", async () => {
      const res = await as(dentistAToken).get(reportUrl("2026-07-01T00:00:00.000Z", "2026-07-31T23:59:59.000Z"));
      expect(res.status).toBe(200);
      const clinic = res.body.clinics[0];
      expect(clinic.materialCost).toBe(0);
    });

    it("monthly breakdown: materialCost=0 quando materialByDentist=true", async () => {
      const res = await as(dentistAToken).get(reportUrl("2026-07-01T00:00:00.000Z", "2026-07-31T23:59:59.000Z"));
      expect(res.status).toBe(200);
      expect(res.body.monthly[0].materialCost).toBe(0);
    });
  });

  describe("isolamento entre orgs", () => {
    it("Org2 DENTIST não consegue criar atendimento com patientId de Org1", async () => {
      const res = await as(dentistBToken).post("/attendances", {
        patientId,
        clinicId: clinicOrg2Id,
        procedureId: procedureOrg2Id,
        date: "2026-07-10T12:00:00.000Z",
        grossValue: 200,
        repassePercentage: 50,
        materialCost: 0,
        materialByDentist: true,
        materialUsages: [],
      });
      expect(res.status).toBe(404);
    });

    it("Org2 DENTIST não vê relatório de Org1", async () => {
      const res = await as(dentistBToken).get(reportUrl("2026-01-01T00:00:00.000Z", "2026-12-31T23:59:59.000Z"));
      expect(res.status).toBe(200);
      expect(res.body.clinics.every((c: { clinicId: string }) => c.clinicId !== clinicId)).toBe(true);
    });
  });
});
