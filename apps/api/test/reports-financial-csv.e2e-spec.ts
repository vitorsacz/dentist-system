import request from "supertest";
import { Test } from "@nestjs/testing";
import type { NestExpressApplication } from "@nestjs/platform-express";
import * as bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";
import { TEST_DATABASE_URL } from "./test-db";
import { teardownAll } from "./helpers/teardown";

// FL2: GET /reports/financial/csv — export CSV por papel e isolamento

const rawPrisma = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } });
const TEST_PASSWORD = "SenhaForte12345";

const stripBom = (s: string) => (s.charCodeAt(0) === 0xfeff ? s.slice(1) : s);

describe("Reports — /reports/financial/csv (e2e)", () => {
  let app: NestExpressApplication;

  let adminToken: string;
  let dentistToken: string;
  let receptionistToken: string;

  async function loginAs(email: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ identifier: email, password: TEST_PASSWORD });
    expect(res.status).toBe(200);
    return res.body.accessToken as string;
  }

  function csvUrl(from: string, to: string) {
    return `/reports/financial/csv?from=${from}&to=${to}`;
  }

  function as(token: string) {
    return { get: (url: string) => request(app.getHttpServer()).get(url).set("Authorization", `Bearer ${token}`) };
  }

  const RANGE = { from: "2025-05-01T00:00:00.000Z", to: "2025-05-31T23:59:59.000Z" };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.init();

    await teardownAll(rawPrisma);

    const hash = await bcrypt.hash(TEST_PASSWORD, 10);
    const ts = Date.now();

    const org = await rawPrisma.organization.create({ data: { name: `CSV Org ${ts}`, type: "CLINIC" } });

    const admin = await rawPrisma.user.create({
      data: { organizationId: org.id, email: `csv-admin-${ts}@t.com`, passwordHash: hash, name: "Admin CSV", roles: ["ADMIN"] },
    });
    await rawPrisma.organization.update({ where: { id: org.id }, data: { foundingAdminUserId: admin.id } });

    const dentist = await rawPrisma.user.create({
      data: { organizationId: org.id, email: `csv-dentist-${ts}@t.com`, passwordHash: hash, name: "Dentist CSV", roles: ["DENTIST"] },
    });
    const receptionist = await rawPrisma.user.create({
      data: { organizationId: org.id, email: `csv-recep-${ts}@t.com`, passwordHash: hash, name: "Recep CSV", roles: ["RECEPTIONIST"] },
    });

    const proc = await rawPrisma.procedureCatalog.create({
      data: { organizationId: org.id, name: "Proc CSV", defaultValue: 500 },
    });
    const clinic = await rawPrisma.clinic.create({
      data: { organizationId: org.id, name: "Clínica CSV", type: "OWN", colorToken: "BRAND" },
    });
    const patient = await rawPrisma.patient.create({
      data: { organizationId: org.id, name: "Patient CSV", phone: "11900200003", createdByUserId: dentist.id, ownerDentistId: dentist.id },
    });

    // gross=500 repasse=50%=250 material=30
    await rawPrisma.attendance.create({
      data: { organizationId: org.id, patientId: patient.id, clinicId: clinic.id, procedureId: proc.id, date: new Date("2025-05-15"), grossValue: 500, repassePercentage: 50, materialCost: 30, createdByUserId: dentist.id, dentistUserId: dentist.id },
    });

    adminToken = await loginAs(admin.email);
    dentistToken = await loginAs(dentist.email);
    receptionistToken = await loginAs(receptionist.email);
  }, 60000);

  afterAll(async () => {
    await app.close();
    await rawPrisma.$disconnect();
  });

  it("sem token → 401", async () => {
    const res = await request(app.getHttpServer()).get(csvUrl(RANGE.from, RANGE.to));
    expect(res.status).toBe(401);
  });

  it("RECEPTIONIST → 403", async () => {
    const res = await as(receptionistToken).get(csvUrl(RANGE.from, RANGE.to));
    expect(res.status).toBe(403);
  });

  it("ADMIN: 200, Content-Type text/csv, Content-Disposition attachment", async () => {
    const res = await as(adminToken).get(csvUrl(RANGE.from, RANGE.to));
    expect(res.status).toBe(200);
    expect(res.header["content-type"]).toContain("text/csv");
    expect(res.header["content-disposition"]).toContain("attachment");
    expect(res.header["content-disposition"]).toContain(".csv");
  });

  it("ADMIN: CSV contém coluna Dentista (admin view)", async () => {
    const res = await as(adminToken).get(csvUrl(RANGE.from, RANGE.to));
    expect(res.text).toContain("Dentista");
    expect(res.text).toContain("Consultório");
    expect(res.text).toContain("Faturamento Bruto");
  });

  it("ADMIN: CSV contém dados do atendimento (gross=500,00 repasse=250,00)", async () => {
    const res = await as(adminToken).get(csvUrl(RANGE.from, RANGE.to));
    expect(res.text).toContain("Dentist CSV");
    expect(res.text).toContain("500,00");
    expect(res.text).toContain("250,00");
    expect(res.text).toContain("30,00");
  });

  it("ADMIN: CSV contém linha Total com valores corretos", async () => {
    const res = await as(adminToken).get(csvUrl(RANGE.from, RANGE.to));
    const lines = stripBom(res.text).split(/\r?\n/);
    const totalLine = lines.find((l) => l.startsWith('"Total"'));
    expect(totalLine).toBeTruthy();
    expect(totalLine).toContain("500,00");
  });

  it("DENTIST: 200, CSV sem coluna Dentista (view própria)", async () => {
    const res = await as(dentistToken).get(csvUrl(RANGE.from, RANGE.to));
    expect(res.status).toBe(200);
    const firstLine = stripBom(res.text).split(/\r?\n/)[0] ?? "";
    // DENTIST view: primeira coluna é Consultório, não Dentista
    expect(firstLine.startsWith("Consultório")).toBe(true);
  });

  it("DENTIST: CSV contém dados do próprio atendimento", async () => {
    const res = await as(dentistToken).get(csvUrl(RANGE.from, RANGE.to));
    expect(res.text).toContain("500,00");
  });

  it("período sem atendimento: CSV com linha de cabeçalho + linha Total zerada", async () => {
    const res = await as(adminToken).get(csvUrl("2020-01-01T00:00:00.000Z", "2020-01-31T23:59:59.000Z"));
    expect(res.status).toBe(200);
    const lines = stripBom(res.text).split(/\r?\n/).filter(Boolean);
    // header + Total (nenhuma linha de dado)
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain("0,00");
  });
});
