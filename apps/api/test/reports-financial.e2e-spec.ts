import request from "supertest";
import { Test } from "@nestjs/testing";
import type { NestExpressApplication } from "@nestjs/platform-express";
import * as bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";
import { TEST_DATABASE_URL } from "./test-db";
import { teardownAll } from "./helpers/teardown";

// F1: DENTIST vê só o próprio financeiro
// F2: aluguel por dia só em FREELANCER; CLINIC → rentCost sempre 0
// FL2: consultório sem termos definidos → clinicsWithoutTerms avisa (não zero silencioso)
// Isolamento: DENTIST de outra org não vê relatório alheio

const rawPrisma = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } });
const TEST_PASSWORD = "SenhaForte12345";

describe("Reports — /reports/financial (e2e)", () => {
  let app: NestExpressApplication;

  // Org 1 — CLINIC
  let orgClinicId: string;
  let dentistA1Token: string;
  let dentistA1Id: string;
  let dentistA2Token: string;
  let dentistA2Id: string;
  let clinicC1Id: string;
  let procedureC1Id: string;

  // Org 2 — FREELANCER
  let orgFLId: string;
  let dentistFLToken: string;
  let dentistFLId: string;
  let clinicFL1Id: string;        // com termos RENTED_FIXED DAILY
  let clinicFL2Id: string;        // sem termos
  let procedureFLId: string;

  // Org 3 — CLINIC (isolamento cross-org)
  let dentistB1Token: string;

  function as(token: string) {
    const srv = () => app.getHttpServer();
    return {
      get: (url: string) => request(srv()).get(url).set("Authorization", `Bearer ${token}`),
    };
  }

  async function loginAs(email: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ identifier: email, password: TEST_PASSWORD });
    expect(res.status).toBe(200);
    return res.body.accessToken as string;
  }

  function reportUrl(from: string, to: string, clinicId?: string) {
    return `/reports/financial?from=${from}&to=${to}${clinicId ? `&clinicId=${clinicId}` : ""}`;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.init();

    await teardownAll(rawPrisma);

    const hash = await bcrypt.hash(TEST_PASSWORD, 10);
    const ts = Date.now();

    // ── Org 1 (CLINIC) ────────────────────────────────────────────────────────
    const orgClinic = await rawPrisma.organization.create({ data: { name: `RepFin Org1 ${ts}`, type: "CLINIC" } });
    orgClinicId = orgClinic.id;

    const dA1 = await rawPrisma.user.create({
      data: { organizationId: orgClinicId, email: `rf-da1-${ts}@t.com`, passwordHash: hash, name: "DA1 RepFin", roles: ["DENTIST"] },
    });
    dentistA1Id = dA1.id;
    await rawPrisma.organization.update({ where: { id: orgClinicId }, data: { foundingAdminUserId: dentistA1Id } });

    const dA2 = await rawPrisma.user.create({
      data: { organizationId: orgClinicId, email: `rf-da2-${ts}@t.com`, passwordHash: hash, name: "DA2 RepFin", roles: ["DENTIST"] },
    });
    dentistA2Id = dA2.id;

    const procC1 = await rawPrisma.procedureCatalog.create({
      data: { organizationId: orgClinicId, name: "Proc C1 RF", defaultValue: 300 },
    });
    procedureC1Id = procC1.id;

    const clinicC1 = await rawPrisma.clinic.create({
      data: { organizationId: orgClinicId, name: "Clinic C1 RF", type: "OWN", colorToken: "BRAND" },
    });
    clinicC1Id = clinicC1.id;

    const patientC1 = await rawPrisma.patient.create({
      data: { organizationId: orgClinicId, name: "Patient C1 RF", phone: "11900100001", createdByUserId: dentistA1Id, ownerDentistId: dentistA1Id },
    });
    await rawPrisma.patientShare.create({
      data: { patientId: patientC1.id, dentistId: dentistA2Id, organizationId: orgClinicId, sharedById: dentistA1Id },
    });

    // Seed: um atendimento de dA1 e um de dA2 — dA1 só deve ver o próprio (F1)
    await rawPrisma.attendance.create({
      data: { organizationId: orgClinicId, patientId: patientC1.id, clinicId: clinicC1Id, procedureId: procedureC1Id, date: new Date("2025-01-15"), grossValue: 300, repassePercentage: 50, materialCost: 20, createdByUserId: dentistA1Id, dentistUserId: dentistA1Id },
    });
    await rawPrisma.attendance.create({
      data: { organizationId: orgClinicId, patientId: patientC1.id, clinicId: clinicC1Id, procedureId: procedureC1Id, date: new Date("2025-01-16"), grossValue: 400, repassePercentage: 60, materialCost: 10, createdByUserId: dentistA2Id, dentistUserId: dentistA2Id },
    });

    // ── Org 2 (FREELANCER) ────────────────────────────────────────────────────
    const orgFL = await rawPrisma.organization.create({ data: { name: `RepFin OrgFL ${ts}`, type: "FREELANCER" } });
    orgFLId = orgFL.id;

    const dFL = await rawPrisma.user.create({
      data: { organizationId: orgFLId, email: `rf-dfl-${ts}@t.com`, passwordHash: hash, name: "DFL RepFin", roles: ["DENTIST"] },
    });
    dentistFLId = dFL.id;
    await rawPrisma.organization.update({ where: { id: orgFLId }, data: { foundingAdminUserId: dentistFLId } });

    const procFL = await rawPrisma.procedureCatalog.create({
      data: { organizationId: orgFLId, name: "Proc FL RF", defaultValue: 200 },
    });
    procedureFLId = procFL.id;

    // Clinic FL1: com termos RENTED_FIXED DAILY = R$80/dia
    const clinicFL1 = await rawPrisma.clinic.create({
      data: { organizationId: orgFLId, name: "Clinic FL1 RF", type: "RENTED", colorToken: "INFO" },
    });
    clinicFL1Id = clinicFL1.id;
    await rawPrisma.clinicFinancialTerms.create({
      data: { clinicId: clinicFL1Id, organizationId: orgFLId, relationshipType: "RENTED_FIXED", rentValue: 80, rentPeriodicity: "DAILY" },
    });

    // Clinic FL2: sem termos definidos
    const clinicFL2 = await rawPrisma.clinic.create({
      data: { organizationId: orgFLId, name: "Clinic FL2 RF", type: "RENTED", colorToken: "WARNING" },
    });
    clinicFL2Id = clinicFL2.id;

    const patientFL = await rawPrisma.patient.create({
      data: { organizationId: orgFLId, name: "Patient FL RF", phone: "11900100002", createdByUserId: dentistFLId, ownerDentistId: dentistFLId },
    });

    // 2 atendimentos no mesmo dia (FL1) → aluguel conta UMA vez
    await rawPrisma.attendance.create({
      data: { organizationId: orgFLId, patientId: patientFL.id, clinicId: clinicFL1Id, procedureId: procedureFLId, date: new Date("2025-02-10"), grossValue: 200, repassePercentage: 50, materialCost: 15, createdByUserId: dentistFLId, dentistUserId: dentistFLId },
    });
    await rawPrisma.attendance.create({
      data: { organizationId: orgFLId, patientId: patientFL.id, clinicId: clinicFL1Id, procedureId: procedureFLId, date: new Date("2025-02-10"), grossValue: 150, repassePercentage: 50, materialCost: 10, createdByUserId: dentistFLId, dentistUserId: dentistFLId },
    });
    // Atendimento em dia diferente (FL1) → 2 dias de aluguel total
    await rawPrisma.attendance.create({
      data: { organizationId: orgFLId, patientId: patientFL.id, clinicId: clinicFL1Id, procedureId: procedureFLId, date: new Date("2025-02-11"), grossValue: 180, repassePercentage: 50, materialCost: 5, createdByUserId: dentistFLId, dentistUserId: dentistFLId },
    });
    // Atendimento em FL2 (sem termos)
    await rawPrisma.attendance.create({
      data: { organizationId: orgFLId, patientId: patientFL.id, clinicId: clinicFL2Id, procedureId: procedureFLId, date: new Date("2025-02-12"), grossValue: 100, repassePercentage: 50, materialCost: 0, createdByUserId: dentistFLId, dentistUserId: dentistFLId },
    });

    // ── Org 3 (CLINIC, isolamento) ─────────────────────────────────────────────
    const org3 = await rawPrisma.organization.create({ data: { name: `RepFin Org3 ${ts}`, type: "CLINIC" } });
    const dB1 = await rawPrisma.user.create({
      data: { organizationId: org3.id, email: `rf-db1-${ts}@t.com`, passwordHash: hash, name: "DB1 RepFin", roles: ["DENTIST"] },
    });
    await rawPrisma.organization.update({ where: { id: org3.id }, data: { foundingAdminUserId: dB1.id } });

    // ── Tokens ────────────────────────────────────────────────────────────────
    dentistA1Token = await loginAs(dA1.email);
    dentistA2Token = await loginAs(dA2.email);
    dentistFLToken = await loginAs(dFL.email);
    dentistB1Token = await loginAs(dB1.email);
  }, 60000);

  afterAll(async () => {
    await app.close();
    await rawPrisma.$disconnect();
  });

  // ── F1: DENTIST vê só o próprio ───────────────────────────────────────────

  describe("F1 — DENTIST vê só o próprio financeiro", () => {
    it("dA1 recebe só os seus atendimentos (não os de dA2)", async () => {
      const res = await as(dentistA1Token).get(reportUrl("2025-01-01T00:00:00", "2025-01-31T23:59:59"));
      expect(res.status).toBe(200);
      const { clinics, totals } = res.body;
      // dA1 tem 1 atendimento: gross=300, repasse=50%=150, material=20
      expect(clinics).toHaveLength(1);
      expect(clinics[0].grossRevenue).toBeCloseTo(300);
      expect(clinics[0].dentistRepasse).toBeCloseTo(150);
      expect(clinics[0].materialCost).toBeCloseTo(20);
      // CLINIC → rentCost sempre 0 (F2)
      expect(clinics[0].rentCost).toBe(0);
      expect(totals.grossRevenue).toBeCloseTo(300);
    });

    it("dA2 recebe só os seus atendimentos (não os de dA1)", async () => {
      const res = await as(dentistA2Token).get(reportUrl("2025-01-01T00:00:00", "2025-01-31T23:59:59"));
      expect(res.status).toBe(200);
      expect(res.body.totals.grossRevenue).toBeCloseTo(400);
    });
  });

  // ── F2: aluguel só em FREELANCER ──────────────────────────────────────────

  describe("F2 — aluguel por dia só em FREELANCER", () => {
    it("CLINIC: rentCost = 0 mesmo com clinic.type = RENTED e dailyRentValue preenchido", async () => {
      const res = await as(dentistA1Token).get(reportUrl("2025-01-01T00:00:00", "2025-01-31T23:59:59"));
      expect(res.status).toBe(200);
      for (const row of res.body.clinics) {
        expect(row.rentCost).toBe(0);
      }
      expect(res.body.totals.rentCost).toBe(0);
    });

    it("FREELANCER: 2 atendimentos no mesmo dia → aluguel conta UMA vez (R$80)", async () => {
      const res = await as(dentistFLToken).get(reportUrl("2025-02-10T00:00:00", "2025-02-10T23:59:59"));
      expect(res.status).toBe(200);
      const fl1Row = res.body.clinics.find((r: { clinicId: string }) => r.clinicId === clinicFL1Id);
      expect(fl1Row).toBeDefined();
      // 2 atendimentos no mesmo dia: 1 único dia de aluguel × R$80
      expect(fl1Row.rentCost).toBeCloseTo(80);
    });

    it("FREELANCER: 2 dias diferentes → aluguel conta 2 vezes (R$160)", async () => {
      const res = await as(dentistFLToken).get(reportUrl("2025-02-10T00:00:00", "2025-02-11T23:59:59"));
      expect(res.status).toBe(200);
      const fl1Row = res.body.clinics.find((r: { clinicId: string }) => r.clinicId === clinicFL1Id);
      expect(fl1Row).toBeDefined();
      expect(fl1Row.rentCost).toBeCloseTo(160);
    });
  });

  // ── FL2: consultório sem termos → aviso claro ─────────────────────────────

  describe("FL2 — consultório sem termos: clinicsWithoutTerms avisa", () => {
    it("FL2 sem termos aparece em clinicsWithoutTerms, não silenciosamente como 0", async () => {
      const res = await as(dentistFLToken).get(reportUrl("2025-02-01T00:00:00", "2025-02-28T23:59:59"));
      expect(res.status).toBe(200);
      expect(res.body.clinicsWithoutTerms).toContain("Clinic FL2 RF");
    });

    it("FL1 com termos não aparece em clinicsWithoutTerms", async () => {
      const res = await as(dentistFLToken).get(reportUrl("2025-02-01T00:00:00", "2025-02-28T23:59:59"));
      expect(res.status).toBe(200);
      expect(res.body.clinicsWithoutTerms).not.toContain("Clinic FL1 RF");
    });

    it("CLINIC: clinicsWithoutTerms vazio (conceito não se aplica)", async () => {
      const res = await as(dentistA1Token).get(reportUrl("2025-01-01T00:00:00", "2025-01-31T23:59:59"));
      expect(res.status).toBe(200);
      expect(res.body.clinicsWithoutTerms).toHaveLength(0);
    });
  });

  // ── Isolamento entre orgs ─────────────────────────────────────────────────

  describe("Isolamento — DENTIST de Org3 não vê dados de Org1 ou OrgFL", () => {
    it("dB1 recebe relatório vazio para o período onde só Org1/OrgFL têm atendimentos", async () => {
      const res = await as(dentistB1Token).get(reportUrl("2025-01-01T00:00:00", "2025-02-28T23:59:59"));
      expect(res.status).toBe(200);
      expect(res.body.clinics).toHaveLength(0);
      expect(res.body.totals.grossRevenue).toBe(0);
    });
  });

  // ── Acesso por papel ──────────────────────────────────────────────────────

  describe("Controle de acesso", () => {
    it("sem token → 401", async () => {
      const res = await request(app.getHttpServer()).get(reportUrl("2025-01-01T00:00:00", "2025-01-31T23:59:59"));
      expect(res.status).toBe(401);
    });
  });
});
