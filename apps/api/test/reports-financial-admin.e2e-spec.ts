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
//     DENTIST vê só o próprio (unchanged — testado em reports-financial.e2e-spec)
//     RECEPTIONIST → 403 (removido do access.ts)
//     Isolamento: ADMIN de Org2 não vê dados de Org1
//     FL2-dedup: FREELANCER 2 dentistas mesmo consultório mesmo dia → aluguel não duplica

const rawPrisma = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } });
const TEST_PASSWORD = "SenhaForte12345";

describe("Reports — /reports/financial F3 ADMIN (e2e)", () => {
  let app: NestExpressApplication;

  let adminToken: string;
  let dentistAToken: string;
  let dentistAId: string;
  let dentistBId: string;
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

    const patient = await rawPrisma.patient.create({
      data: { organizationId: org1.id, name: "Patient F3", phone: "11900200001", createdByUserId: dA.id, ownerDentistId: dA.id },
    });
    await rawPrisma.patientShare.create({
      data: { patientId: patient.id, dentistId: dB.id, organizationId: org1.id, sharedById: dA.id },
    });

    // dA: 1 atendimento gross=300 repasse=50%=150 material=20
    await rawPrisma.attendance.create({
      data: { organizationId: org1.id, patientId: patient.id, clinicId: clinic.id, procedureId: proc.id, date: new Date("2025-03-10"), grossValue: 300, repassePercentage: 50, materialCost: 20, createdByUserId: dA.id, dentistUserId: dA.id },
    });
    // dB: 1 atendimento gross=400 repasse=60%=240 material=10
    await rawPrisma.attendance.create({
      data: { organizationId: org1.id, patientId: patient.id, clinicId: clinic.id, procedureId: proc.id, date: new Date("2025-03-11"), grossValue: 400, repassePercentage: 60, materialCost: 10, createdByUserId: dB.id, dentistUserId: dB.id },
    });

    // ── Org 2 — isolamento ────────────────────────────────────────────────────
    const org2 = await rawPrisma.organization.create({ data: { name: `F3 Org2 ${ts}`, type: "CLINIC" } });
    const admin2 = await rawPrisma.user.create({
      data: { organizationId: org2.id, email: `f3-admin2-${ts}@t.com`, passwordHash: hash, name: "Admin2 F3", roles: ["ADMIN"] },
    });
    await rawPrisma.organization.update({ where: { id: org2.id }, data: { foundingAdminUserId: admin2.id } });

    // ── Tokens ────────────────────────────────────────────────────────────────
    adminToken = await loginAs(admin.email);
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

    it("monthly: 1 entrada para Março (ambos no mesmo mês) com gross=700", async () => {
      const res = await as(adminToken).get(reportUrl(RANGE.from, RANGE.to));
      expect(res.body.monthly).toHaveLength(1);
      expect(res.body.monthly[0].month).toBe("2025-03");
      expect(res.body.monthly[0].grossRevenue).toBeCloseTo(700);
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

    it("RECEPTIONIST → 403 (removido da capability reports.financial)", async () => {
      const hash = await bcrypt.hash(TEST_PASSWORD, 10);
      const ts = Date.now();
      const org = await rawPrisma.organization.create({ data: { name: `F3 Acl ${ts}` } });
      const recep = await rawPrisma.user.create({
        data: { organizationId: org.id, email: `f3-recep-acl-${ts}@t.com`, passwordHash: hash, name: "Recep ACL", roles: ["RECEPTIONIST"] },
      });
      const token = await loginAs(recep.email);
      const res = await as(token).get(reportUrl(RANGE.from, RANGE.to));
      expect(res.status).toBe(403);
    });
  });
});

// ── FREELANCER: aluguel diário não duplica quando 2 dentistas no mesmo dia ───

describe("Reports — FREELANCER rent dedup: 2 dentistas mesmo dia (e2e)", () => {
  let app: NestExpressApplication;
  let adminToken: string;
  let dentistCId: string;
  let dentistDId: string;

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

    // FREELANCER org
    const org = await rawPrisma.organization.create({ data: { name: `FL Dedup ${ts}`, type: "FREELANCER" } });

    const admin = await rawPrisma.user.create({
      data: { organizationId: org.id, email: `fl-admin-${ts}@t.com`, passwordHash: hash, name: "Admin FL", roles: ["ADMIN"] },
    });
    await rawPrisma.organization.update({ where: { id: org.id }, data: { foundingAdminUserId: admin.id } });

    const dC = await rawPrisma.user.create({
      data: { organizationId: org.id, email: `fl-dc-${ts}@t.com`, passwordHash: hash, name: "DentistC FL", roles: ["DENTIST"] },
    });
    dentistCId = dC.id;

    const dD = await rawPrisma.user.create({
      data: { organizationId: org.id, email: `fl-dd-${ts}@t.com`, passwordHash: hash, name: "DentistD FL", roles: ["DENTIST"] },
    });
    dentistDId = dD.id;

    const proc = await rawPrisma.procedureCatalog.create({
      data: { organizationId: org.id, name: "Proc FL", defaultValue: 200 },
    });

    const clinic = await rawPrisma.clinic.create({
      data: { organizationId: org.id, name: "Clinic FL", type: "OWN", colorToken: "BRAND" },
    });

    // RENTED_FIXED DAILY rentValue=80
    await rawPrisma.clinicFinancialTerms.create({
      data: { organizationId: org.id, clinicId: clinic.id, relationshipType: "RENTED_FIXED", rentPeriodicity: "DAILY", rentValue: 80 },
    });

    const patient = await rawPrisma.patient.create({
      data: { organizationId: org.id, name: "Patient FL", phone: "11900200002", createdByUserId: dC.id, ownerDentistId: dC.id },
    });
    await rawPrisma.patientShare.create({
      data: { patientId: patient.id, dentistId: dD.id, organizationId: org.id, sharedById: dC.id },
    });

    // dC e dD: atendimentos no MESMO DIA (2025-04-10)
    await rawPrisma.attendance.create({
      data: { organizationId: org.id, patientId: patient.id, clinicId: clinic.id, procedureId: proc.id, date: new Date("2025-04-10"), grossValue: 200, repassePercentage: 50, materialCost: 10, createdByUserId: dC.id, dentistUserId: dC.id },
    });
    await rawPrisma.attendance.create({
      data: { organizationId: org.id, patientId: patient.id, clinicId: clinic.id, procedureId: proc.id, date: new Date("2025-04-10"), grossValue: 200, repassePercentage: 50, materialCost: 10, createdByUserId: dD.id, dentistUserId: dD.id },
    });

    adminToken = await loginAs(admin.email);
  }, 60000);

  afterAll(async () => {
    await app.close();
    await rawPrisma.$disconnect();
  });

  const RANGE = { from: "2025-04-01T00:00:00.000Z", to: "2025-04-30T23:59:59.000Z" };

  it("ADMIN recebe 2 linhas (uma por dentista)", async () => {
    const res = await request(app.getHttpServer())
      .get(reportUrl(RANGE.from, RANGE.to))
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.clinics).toHaveLength(2);
    expect(res.body.clinics.map((r: { dentistUserId: string }) => r.dentistUserId).sort()).toEqual(
      [dentistCId, dentistDId].sort(),
    );
  });

  it("per-row rentCost=0 em admin view (aluguel é custo do consultório, não do dentista)", async () => {
    const res = await request(app.getHttpServer())
      .get(reportUrl(RANGE.from, RANGE.to))
      .set("Authorization", `Bearer ${adminToken}`);
    for (const row of res.body.clinics) {
      expect(row.rentCost).toBe(0);
    }
  });

  it("totals.rentCost=80 (não 160) — aluguel de 1 dia conta uma vez", async () => {
    const res = await request(app.getHttpServer())
      .get(reportUrl(RANGE.from, RANGE.to))
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.body.totals.rentCost).toBeCloseTo(80);
  });

  it("totals.grossRevenue=400, totals.dentistRepasse=200, totals.materialCost=20", async () => {
    const res = await request(app.getHttpServer())
      .get(reportUrl(RANGE.from, RANGE.to))
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.body.totals.grossRevenue).toBeCloseTo(400);
    expect(res.body.totals.dentistRepasse).toBeCloseTo(200);
    expect(res.body.totals.materialCost).toBeCloseTo(20);
  });

  it("totals.netResult = dentistRepasse - materialCost - rentCost = 200-20-80 = 100", async () => {
    const res = await request(app.getHttpServer())
      .get(reportUrl(RANGE.from, RANGE.to))
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.body.totals.netResult).toBeCloseTo(100);
  });

  it("monthly: 1 entrada para Abril com gross=400, rentCost=80", async () => {
    const res = await request(app.getHttpServer())
      .get(reportUrl(RANGE.from, RANGE.to))
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.body.monthly).toHaveLength(1);
    expect(res.body.monthly[0].month).toBe("2025-04");
    expect(res.body.monthly[0].grossRevenue).toBeCloseTo(400);
    expect(res.body.monthly[0].rentCost).toBeCloseTo(80);
    expect(res.body.monthly[0].netResult).toBeCloseTo(100);
  });
});
