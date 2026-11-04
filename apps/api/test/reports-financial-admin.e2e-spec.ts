import request from "supertest";
import { Test } from "@nestjs/testing";
import type { NestExpressApplication } from "@nestjs/platform-express";
import * as bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";
import { TEST_DATABASE_URL } from "./test-db";
import { teardownAll } from "./helpers/teardown";

// F3: ADMIN vê relatório consolidado por dentista+consultório (com valores)
//     RECEPTIONIST vê mesmo relatório mas valores zerados
//     DENTIST vê só o próprio (unchanged — testado em reports-financial.e2e-spec)
//     Isolamento: ADMIN de Org2 não vê dados de Org1

const rawPrisma = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } });
const TEST_PASSWORD = "SenhaForte12345";

describe("Reports — /reports/financial F3 ADMIN/RECEPTIONIST (e2e)", () => {
  let app: NestExpressApplication;

  let adminToken: string;
  let receptionistToken: string;
  let dentistAToken: string;
  let dentistAId: string;
  let dentistBId: string;
  let clinicId: string;
  let adminOrg2Token: string;

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
    const org1 = await rawPrisma.organization.create({ data: { name: `F3 Org1 ${ts}`, type: "CLINIC" } });

    const admin = await rawPrisma.user.create({
      data: { organizationId: org1.id, email: `f3-admin-${ts}@t.com`, passwordHash: hash, name: "Admin F3", roles: ["ADMIN"] },
    });
    await rawPrisma.organization.update({ where: { id: org1.id }, data: { foundingAdminUserId: admin.id } });

    const receptionist = await rawPrisma.user.create({
      data: { organizationId: org1.id, email: `f3-recep-${ts}@t.com`, passwordHash: hash, name: "Recep F3", roles: ["RECEPTIONIST"] },
    });

    const dA = await rawPrisma.user.create({
      data: { organizationId: org1.id, email: `f3-da-${ts}@t.com`, passwordHash: hash, name: "DentistA F3", roles: ["DENTIST"] },
    });
    dentistAId = dA.id;

    const dB = await rawPrisma.user.create({
      data: { organizationId: org1.id, email: `f3-db-${ts}@t.com`, passwordHash: hash, name: "DentistB F3", roles: ["DENTIST"] },
    });
    dentistBId = dB.id;

    const proc = await rawPrisma.procedureCatalog.create({
      data: { organizationId: org1.id, name: "Proc F3", defaultValue: 300 },
    });

    const clinic = await rawPrisma.clinic.create({
      data: { organizationId: org1.id, name: "Clinic F3", type: "OWN", colorToken: "BRAND" },
    });
    clinicId = clinic.id;

    const patient = await rawPrisma.patient.create({
      data: { organizationId: org1.id, name: "Patient F3", phone: "11900200001", createdByUserId: dA.id, ownerDentistId: dA.id },
    });
    await rawPrisma.patientShare.create({
      data: { patientId: patient.id, dentistId: dB.id, organizationId: org1.id, sharedById: dA.id },
    });

    // dA: 1 atendimento gross=300 repasse=50%=150 material=20
    await rawPrisma.attendance.create({
      data: { organizationId: org1.id, patientId: patient.id, clinicId, procedureId: proc.id, date: new Date("2025-03-10"), grossValue: 300, repassePercentage: 50, materialCost: 20, createdByUserId: dA.id, dentistUserId: dA.id },
    });
    // dB: 1 atendimento gross=400 repasse=60%=240 material=10
    await rawPrisma.attendance.create({
      data: { organizationId: org1.id, patientId: patient.id, clinicId, procedureId: proc.id, date: new Date("2025-03-11"), grossValue: 400, repassePercentage: 60, materialCost: 10, createdByUserId: dB.id, dentistUserId: dB.id },
    });

    // ── Org 2 — isolamento ────────────────────────────────────────────────────
    const org2 = await rawPrisma.organization.create({ data: { name: `F3 Org2 ${ts}`, type: "CLINIC" } });
    const admin2 = await rawPrisma.user.create({
      data: { organizationId: org2.id, email: `f3-admin2-${ts}@t.com`, passwordHash: hash, name: "Admin2 F3", roles: ["ADMIN"] },
    });
    await rawPrisma.organization.update({ where: { id: org2.id }, data: { foundingAdminUserId: admin2.id } });

    // ── Tokens ────────────────────────────────────────────────────────────────
    adminToken = await loginAs(admin.email);
    receptionistToken = await loginAs(receptionist.email);
    dentistAToken = await loginAs(dA.email);
    adminOrg2Token = await loginAs(admin2.email);
  }, 60000);

  afterAll(async () => {
    await app.close();
    await rawPrisma.$disconnect();
  });

  const RANGE = { from: "2025-03-01T00:00:00.000Z", to: "2025-03-31T23:59:59.000Z" };

  // ── F3: ADMIN vê todos os dentistas ───────────────────────────────────────

  describe("F3 — ADMIN vê relatório consolidado por dentista+consultório", () => {
    it("ADMIN recebe 2 linhas (uma por dentista)", async () => {
      const res = await as(adminToken).get(reportUrl(RANGE.from, RANGE.to));
      expect(res.status).toBe(200);
      expect(res.body.clinics).toHaveLength(2);
    });

    it("cada linha tem dentistUserId e dentistName preenchidos", async () => {
      const res = await as(adminToken).get(reportUrl(RANGE.from, RANGE.to));
      expect(res.status).toBe(200);
      for (const row of res.body.clinics) {
        expect(row.dentistUserId).toBeTruthy();
        expect(row.dentistName).toBeTruthy();
      }
    });

    it("linha de dA: gross=300, repasse=150, material=20, rentCost=0", async () => {
      const res = await as(adminToken).get(reportUrl(RANGE.from, RANGE.to));
      const rowA = res.body.clinics.find((r: { dentistUserId: string }) => r.dentistUserId === dentistAId);
      expect(rowA).toBeDefined();
      expect(rowA.grossRevenue).toBeCloseTo(300);
      expect(rowA.dentistRepasse).toBeCloseTo(150);
      expect(rowA.materialCost).toBeCloseTo(20);
      expect(rowA.rentCost).toBe(0);
    });

    it("linha de dB: gross=400, repasse=240, material=10, rentCost=0", async () => {
      const res = await as(adminToken).get(reportUrl(RANGE.from, RANGE.to));
      const rowB = res.body.clinics.find((r: { dentistUserId: string }) => r.dentistUserId === dentistBId);
      expect(rowB).toBeDefined();
      expect(rowB.grossRevenue).toBeCloseTo(400);
      expect(rowB.dentistRepasse).toBeCloseTo(240);
      expect(rowB.materialCost).toBeCloseTo(10);
    });

    it("totals refletem soma dos dois dentistas (gross=700)", async () => {
      const res = await as(adminToken).get(reportUrl(RANGE.from, RANGE.to));
      expect(res.body.totals.grossRevenue).toBeCloseTo(700);
      expect(res.body.totals.dentistRepasse).toBeCloseTo(390);
    });
  });

  // ── F3: RECEPTIONIST vê estrutura sem valores ─────────────────────────────

  describe("F3 — RECEPTIONIST vê dentistas+consultórios mas valores zerados", () => {
    it("RECEPTIONIST recebe 2 linhas (uma por dentista)", async () => {
      const res = await as(receptionistToken).get(reportUrl(RANGE.from, RANGE.to));
      expect(res.status).toBe(200);
      expect(res.body.clinics).toHaveLength(2);
    });

    it("cada linha tem dentistUserId preenchido mas valores = 0", async () => {
      const res = await as(receptionistToken).get(reportUrl(RANGE.from, RANGE.to));
      for (const row of res.body.clinics) {
        expect(row.dentistUserId).toBeTruthy();
        expect(row.grossRevenue).toBe(0);
        expect(row.dentistRepasse).toBe(0);
        expect(row.materialCost).toBe(0);
        expect(row.rentCost).toBe(0);
        expect(row.netResult).toBe(0);
      }
    });

    it("totals também zerados para RECEPTIONIST", async () => {
      const res = await as(receptionistToken).get(reportUrl(RANGE.from, RANGE.to));
      const { totals } = res.body;
      expect(totals.grossRevenue).toBe(0);
      expect(totals.dentistRepasse).toBe(0);
      expect(totals.netResult).toBe(0);
    });
  });

  // ── DENTIST ainda vê só o próprio ─────────────────────────────────────────

  describe("DENTIST ainda vê só o próprio (F1 regressão)", () => {
    it("dentistA vê 1 linha (própria, sem dentistUserId na resposta)", async () => {
      const res = await as(dentistAToken).get(reportUrl(RANGE.from, RANGE.to));
      expect(res.status).toBe(200);
      expect(res.body.clinics).toHaveLength(1);
      expect(res.body.clinics[0].grossRevenue).toBeCloseTo(300);
      // DENTIST não recebe campo dentistUserId no row
      expect(res.body.clinics[0].dentistUserId).toBeUndefined();
    });
  });

  // ── Isolamento entre orgs ─────────────────────────────────────────────────

  describe("Isolamento — ADMIN de Org2 não vê dados de Org1", () => {
    it("adminOrg2 recebe relatório vazio para o período onde só Org1 tem atendimentos", async () => {
      const res = await as(adminOrg2Token).get(reportUrl(RANGE.from, RANGE.to));
      expect(res.status).toBe(200);
      expect(res.body.clinics).toHaveLength(0);
      expect(res.body.totals.grossRevenue).toBe(0);
    });
  });

  // ── Controle de acesso ────────────────────────────────────────────────────

  describe("Controle de acesso", () => {
    it("sem token → 401", async () => {
      const res = await request(app.getHttpServer()).get(reportUrl(RANGE.from, RANGE.to));
      expect(res.status).toBe(401);
    });
  });
});
