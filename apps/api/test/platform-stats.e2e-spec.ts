import cookieParser from "cookie-parser";
import request from "supertest";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import * as bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";
import { AppModule } from "../src/app.module";
import { TEST_DATABASE_URL } from "./test-db";

// Cobre o novo dashboard do Super Admin (/platform/stats/overview e
// /platform/organizations/:id): guarda de acesso, agregação correta
// cross-tenant (prova que PRISMA_UNSCOPED_SERVICE atravessa tenants sem
// lançar "Tenant context indisponível") e drill-down cadastral.

const rawPrisma = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } });
const TEST_PASSWORD = "SenhaForte12345";

async function seedFixtures(label: string) {
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
  const org = await rawPrisma.organization.create({ data: { name: `${label} (teste stats)` } });
  const admin = await rawPrisma.user.create({
    data: {
      organizationId: org.id,
      email: `${label}-admin-${Date.now()}-${Math.random()}@test.com`,
      passwordHash,
      name: `${label} Admin`,
      role: "ADMIN",
    },
  });
  await rawPrisma.user.create({
    data: {
      organizationId: org.id,
      email: `${label}-dentist-${Date.now()}-${Math.random()}@test.com`,
      passwordHash,
      name: `${label} Dentista`,
      role: "DENTIST",
      active: true,
    },
  });
  await rawPrisma.organization.update({ where: { id: org.id }, data: { foundingAdminUserId: admin.id } });

  const clinic = await rawPrisma.clinic.create({ data: { organizationId: org.id, name: `${label} Clínica`, type: "OWN" } });
  const patient = await rawPrisma.patient.create({
    data: { organizationId: org.id, name: `${label} Paciente`, phone: "11999999999", createdByUserId: admin.id },
  });
  const procedure = await rawPrisma.procedureCatalog.create({
    data: { organizationId: org.id, name: `${label} Procedimento`, defaultValue: 100 },
  });

  return { org, admin, clinic, patient, procedure };
}

async function seedAttendance(
  fixtures: Awaited<ReturnType<typeof seedFixtures>>,
  date: Date,
) {
  return rawPrisma.attendance.create({
    data: {
      organizationId: fixtures.org.id,
      patientId: fixtures.patient.id,
      clinicId: fixtures.clinic.id,
      procedureId: fixtures.procedure.id,
      createdByUserId: fixtures.admin.id,
      date,
      grossValue: 100,
      repassePercentage: 50,
      materialCost: 0,
    },
  });
}

describe("Platform stats (Super Admin)", () => {
  let app: INestApplication;
  let superAdminToken: string;
  let regularToken: string;
  let orgA: Awaited<ReturnType<typeof seedFixtures>>;
  let orgB: Awaited<ReturnType<typeof seedFixtures>>;

  function as(token: string) {
    return {
      get: (path: string) => request(app.getHttpServer()).get(path).set("Authorization", `Bearer ${token}`),
    };
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();

    await rawPrisma.organization.deleteMany({});
    await rawPrisma.user.deleteMany({});

    orgA = await seedFixtures("OrgA");
    orgB = await seedFixtures("OrgB");
    await rawPrisma.organization.update({ where: { id: orgB.org.id }, data: { status: "SUSPENDED" } });

    const now = new Date();
    // 3 atendimentos de A no mês corrente, 1 de B no mês corrente, 1 de A no mês passado (fora da janela).
    await seedAttendance(orgA, now);
    await seedAttendance(orgA, now);
    await seedAttendance(orgA, now);
    await seedAttendance(orgB, now);
    await seedAttendance(orgA, new Date(now.getFullYear(), now.getMonth() - 1, 15));

    const superAdminEmail = `super-stats-${Date.now()}@test.com`;
    await rawPrisma.user.create({
      data: {
        email: superAdminEmail,
        passwordHash: await bcrypt.hash(TEST_PASSWORD, 10),
        name: "Super Admin Stats",
        isSuperAdmin: true,
        organizationId: null,
        role: null,
      },
    });
    const superAdminLogin = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ identifier: superAdminEmail, password: TEST_PASSWORD });
    superAdminToken = superAdminLogin.body.accessToken;

    const regularLogin = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ identifier: orgA.admin.email, password: TEST_PASSWORD });
    regularToken = regularLogin.body.accessToken;
  }, 30000);

  afterAll(async () => {
    await rawPrisma.organization.deleteMany({});
    await rawPrisma.user.deleteMany({});
    await rawPrisma.$disconnect();
    await app.close();
  });

  it("bloqueia usuário comum em /platform/stats/overview e /platform/organizations/:id", async () => {
    expect((await as(regularToken).get("/platform/stats/overview")).status).toBe(403);
    expect((await as(regularToken).get(`/platform/organizations/${orgA.org.id}`)).status).toBe(403);
  });

  it("overview agrega corretamente através de todos os tenants", async () => {
    const res = await as(superAdminToken).get("/platform/stats/overview");
    expect(res.status).toBe(200);

    const { organizationsByStatus, usersByRole, attendancesThisMonth, topOrganizationsByAttendance } = res.body;

    expect(organizationsByStatus.ACTIVE).toBeGreaterThanOrEqual(1);
    expect(organizationsByStatus.SUSPENDED).toBeGreaterThanOrEqual(1);
    expect(organizationsByStatus.total).toBe(
      organizationsByStatus.ACTIVE + organizationsByStatus.SUSPENDED + organizationsByStatus.DELETED,
    );

    expect(usersByRole.ADMIN).toBeGreaterThanOrEqual(2);
    expect(usersByRole.DENTIST).toBeGreaterThanOrEqual(2);
    expect(usersByRole.total).toBe(usersByRole.ADMIN + usersByRole.DENTIST + usersByRole.RECEPTIONIST);

    // 3 (A) + 1 (B) no mês corrente; o atendimento do mês passado de A fica fora.
    expect(attendancesThisMonth).toBe(4);

    const rankA = topOrganizationsByAttendance.find((row: { organizationId: string }) => row.organizationId === orgA.org.id);
    const rankB = topOrganizationsByAttendance.find((row: { organizationId: string }) => row.organizationId === orgB.org.id);
    expect(rankA.attendanceCount).toBe(3);
    expect(rankB.attendanceCount).toBe(1);
    expect(topOrganizationsByAttendance.indexOf(rankA)).toBeLessThan(topOrganizationsByAttendance.indexOf(rankB));
  });

  it("drill-down por organização retorna dados cadastrais e founding admin; 404 pra id inexistente", async () => {
    const res = await as(superAdminToken).get(`/platform/organizations/${orgA.org.id}`);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe(orgA.org.name);
    expect(res.body.foundingAdmin.email).toBe(orgA.admin.email);

    const notFound = await as(superAdminToken).get("/platform/organizations/id-inexistente");
    expect(notFound.status).toBe(404);
  });
});
