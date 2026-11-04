import request from "supertest";
import { Test } from "@nestjs/testing";
import type { NestExpressApplication } from "@nestjs/platform-express";
import * as bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";
import { TEST_DATABASE_URL } from "./test-db";
import { teardownAll } from "./helpers/teardown";

// Personas:
//   ADMIN        — ADMIN role, Org A. Vê dados org-wide; recebe revenueThisMonth.
//   DENTIST      — DENTIST role, Org A. Vê só seus próprios dados; recebe revenueThisMonth.
//   RECEPTIONIST — RECEPTIONIST role, Org A. Acesso permitido; NÃO recebe revenueThisMonth.
//   FREELANCER   — ADMIN+DENTIST roles, Org FREELANCER. Recebe revenueByClinic.
//   ADMIN2       — ADMIN role, Org B. Não enxerga dados da Org A (isolamento).

const rawPrisma = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } });
const TEST_PASSWORD = "SenhaForte12345";

describe("Dashboard (e2e)", () => {
  let app: NestExpressApplication;
  let tokenAdmin: string;
  let tokenDentist: string;
  let tokenReceptionist: string;
  let tokenFreelancer: string;
  let tokenAdmin2: string;

  function as(token: string) {
    const srv = () => request(app.getHttpServer());
    return {
      get: (url: string) => srv().get(url).set("Authorization", `Bearer ${token}`),
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

    // ── Org A (STANDARD) ────────────────────────────────────────────────────
    const orgA = await rawPrisma.organization.create({ data: { name: "Dashboard Org A" } });

    const adminUser = await rawPrisma.user.create({
      data: { organizationId: orgA.id, email: `dash-admin-${ts}@test.com`, passwordHash: hash, name: "Admin D", roles: ["ADMIN"] },
    });
    await rawPrisma.organization.update({ where: { id: orgA.id }, data: { foundingAdminUserId: adminUser.id } });

    const dentistUser = await rawPrisma.user.create({
      data: { organizationId: orgA.id, email: `dash-dent-${ts}@test.com`, passwordHash: hash, name: "Dentist D", roles: ["DENTIST"] },
    });

    const recUser = await rawPrisma.user.create({
      data: { organizationId: orgA.id, email: `dash-rec-${ts}@test.com`, passwordHash: hash, name: "Rec D", roles: ["RECEPTIONIST"] },
    });

    // ── Org FREELANCER ───────────────────────────────────────────────────────
    const orgFree = await rawPrisma.organization.create({ data: { name: "Dashboard Org Free", type: "FREELANCER" } });

    const freeUser = await rawPrisma.user.create({
      data: { organizationId: orgFree.id, email: `dash-free-${ts}@test.com`, passwordHash: hash, name: "Freelancer D", roles: ["ADMIN", "DENTIST"] },
    });
    await rawPrisma.organization.update({ where: { id: orgFree.id }, data: { foundingAdminUserId: freeUser.id } });

    // ── Org B ────────────────────────────────────────────────────────────────
    const orgB = await rawPrisma.organization.create({ data: { name: "Dashboard Org B" } });
    const admin2User = await rawPrisma.user.create({
      data: { organizationId: orgB.id, email: `dash-admin2-${ts}@test.com`, passwordHash: hash, name: "Admin2 D", roles: ["ADMIN"] },
    });
    await rawPrisma.organization.update({ where: { id: orgB.id }, data: { foundingAdminUserId: admin2User.id } });

    // ── Seed: patient + clinic + procedure + appointment + attendance in Org A ─
    const patient = await rawPrisma.patient.create({
      data: { organizationId: orgA.id, name: "Paciente Teste", phone: "", createdByUserId: adminUser.id },
    });

    const clinic = await rawPrisma.clinic.create({
      data: { organizationId: orgA.id, name: "Clínica Teste", type: "OWN" },
    });

    const procedure = await rawPrisma.procedureCatalog.create({
      data: { organizationId: orgA.id, name: "Consulta Dashboard", defaultValue: 200 },
    });

    const today = new Date();
    today.setUTCHours(10, 0, 0, 0);

    await rawPrisma.appointment.create({
      data: {
        organizationId: orgA.id,
        patientId: patient.id,
        clinicId: clinic.id,
        dentistUserId: dentistUser.id,
        startsAt: today,
        endsAt: new Date(today.getTime() + 3600000),
        status: "SCHEDULED",
      },
    });

    const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));

    await rawPrisma.attendance.create({
      data: {
        organizationId: orgA.id,
        patientId: patient.id,
        clinicId: clinic.id,
        procedureId: procedure.id,
        dentistUserId: dentistUser.id,
        date: monthStart,
        grossValue: 500,
        repassePercentage: 0,
        createdByUserId: adminUser.id,
      },
    });

    // ── Tokens ────────────────────────────────────────────────────────────────
    const login = async (email: string) => {
      const res = await request(app.getHttpServer()).post("/auth/login").send({ identifier: email, password: TEST_PASSWORD });
      return res.body.accessToken as string;
    };
    tokenAdmin = await login(adminUser.email);
    tokenDentist = await login(dentistUser.email);
    tokenReceptionist = await login(recUser.email);
    tokenFreelancer = await login(freeUser.email);
    tokenAdmin2 = await login(admin2User.email);
  }, 30000);

  afterAll(async () => {
    await app.close();
    await rawPrisma.$disconnect();
  });

  it("ADMIN recebe overview com revenueThisMonth e campos admin (200)", async () => {
    const res = await as(tokenAdmin).get("/dashboard/overview");
    expect(res.status).toBe(200);
    expect(typeof res.body.appointmentsThisWeek).toBe("number");
    expect(typeof res.body.activePatients).toBe("number");
    expect(typeof res.body.attendancesThisMonth).toBe("number");
    expect(typeof res.body.revenueThisMonth).toBe("number");
    expect(Array.isArray(res.body.appointmentsToday)).toBe(true);
    // incompleteProfile: Org A tem clínica no seed → false
    expect(res.body.incompleteProfile).toBe(false);
    expect(Array.isArray(res.body.teamMembers)).toBe(true);
    expect(Array.isArray(res.body.stockAlerts)).toBe(true);
  });

  it("ADMIN sem consultório recebe incompleteProfile=true", async () => {
    // Org B não tem clínica criada no seed
    const res = await as(tokenAdmin2).get("/dashboard/overview");
    expect(res.status).toBe(200);
    expect(res.body.incompleteProfile).toBe(true);
  });

  it("DENTIST recebe overview com revenueThisMonth (200)", async () => {
    const res = await as(tokenDentist).get("/dashboard/overview");
    expect(res.status).toBe(200);
    expect(typeof res.body.revenueThisMonth).toBe("number");
  });

  it("RECEPTIONIST recebe overview sem revenueThisMonth nem campos admin (200)", async () => {
    const res = await as(tokenReceptionist).get("/dashboard/overview");
    expect(res.status).toBe(200);
    expect(res.body.revenueThisMonth).toBeUndefined();
    expect(res.body.revenueByClinic).toBeUndefined();
    expect(res.body.incompleteProfile).toBeUndefined();
    expect(res.body.teamMembers).toBeUndefined();
    expect(res.body.stockAlerts).toBeUndefined();
  });

  it("DENTIST não recebe campos admin (200)", async () => {
    const res = await as(tokenDentist).get("/dashboard/overview");
    expect(res.status).toBe(200);
    expect(res.body.incompleteProfile).toBeUndefined();
    expect(res.body.teamMembers).toBeUndefined();
    expect(res.body.stockAlerts).toBeUndefined();
  });

  it("FREELANCER recebe revenueByClinic (200)", async () => {
    const res = await as(tokenFreelancer).get("/dashboard/overview");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.revenueByClinic)).toBe(true);
  });

  it("sem token retorna 401", async () => {
    const res = await request(app.getHttpServer()).get("/dashboard/overview");
    expect(res.status).toBe(401);
  });

  it("ADMIN vê hoje os appointments da org (isolamento de org)", async () => {
    // Admin da Org A vê appointments; Admin2 da Org B não vê os mesmos
    const resA = await as(tokenAdmin).get("/dashboard/overview");
    const resB = await as(tokenAdmin2).get("/dashboard/overview");
    expect(resA.status).toBe(200);
    expect(resB.status).toBe(200);
    const idsA = resA.body.appointmentsToday.map((a: { id: string }) => a.id);
    const idsB = resB.body.appointmentsToday.map((a: { id: string }) => a.id);
    expect(idsA.some((id: string) => idsB.includes(id))).toBe(false);
  });

  it("DENTIST vê só seus appointments (filtro por dentistUserId)", async () => {
    const resDentist = await as(tokenDentist).get("/dashboard/overview");
    const resAdmin = await as(tokenAdmin).get("/dashboard/overview");
    // Admin vê tudo (>= dentist count)
    expect(resAdmin.body.appointmentsThisWeek).toBeGreaterThanOrEqual(resDentist.body.appointmentsThisWeek);
  });
});
