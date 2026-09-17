import cookieParser from "cookie-parser";
import request from "supertest";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import * as bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";
import { AppModule } from "../src/app.module";
import { TEST_DATABASE_URL } from "./test-db";

// Critério de aceite da fundação de multi-tenancy (ver plano técnico): 2
// organizations seedadas, acesso cruzado por ID em todo endpoint tenant-scoped
// deve responder 404 — nunca vazamento de dado, nunca 500.

const rawPrisma = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } });
const TEST_PASSWORD = "SenhaForte12345";

interface OrgContext {
  organizationId: string;
  dentistToken: string;
  adminToken: string;
  adminMembershipId: string;
}

async function seedOrgContext(app: INestApplication, label: string): Promise<OrgContext> {
  const org = await rawPrisma.organization.create({ data: { name: `${label} (teste isolamento)` } });
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);

  const dentistUser = await rawPrisma.user.create({
    data: { email: `${label}-dentist-${Date.now()}-${Math.random()}@test.com`, passwordHash, name: `${label} Dentista` },
  });
  await rawPrisma.membership.create({ data: { userId: dentistUser.id, organizationId: org.id, role: "DENTIST" } });

  const adminUser = await rawPrisma.user.create({
    data: { email: `${label}-admin-${Date.now()}-${Math.random()}@test.com`, passwordHash, name: `${label} Admin` },
  });
  const adminMembership = await rawPrisma.membership.create({
    data: { userId: adminUser.id, organizationId: org.id, role: "ADMIN" },
  });

  const dentistLogin = await request(app.getHttpServer())
    .post("/auth/login")
    .send({ email: dentistUser.email, password: TEST_PASSWORD });
  const adminLogin = await request(app.getHttpServer())
    .post("/auth/login")
    .send({ email: adminUser.email, password: TEST_PASSWORD });

  return {
    organizationId: org.id,
    dentistToken: dentistLogin.body.accessToken,
    adminToken: adminLogin.body.accessToken,
    adminMembershipId: adminMembership.id,
  };
}

describe("Isolamento cross-tenant", () => {
  let app: INestApplication;
  let orgA: OrgContext;
  let orgB: OrgContext;

  function as(token: string) {
    const server = () => app.getHttpServer();
    return {
      get: (path: string) => request(server()).get(path).set("Authorization", `Bearer ${token}`),
      post: (path: string, body: Record<string, unknown>) =>
        request(server()).post(path).set("Authorization", `Bearer ${token}`).send(body),
      patch: (path: string, body: Record<string, unknown>) =>
        request(server()).patch(path).set("Authorization", `Bearer ${token}`).send(body),
    };
  }

  async function createPatient(token: string, name = "Paciente Teste") {
    const res = await as(token).post("/patients", { name, phone: "11999999999" });
    expect(res.status).toBe(201);
    return res.body.id as string;
  }

  async function createClinic(token: string, name = "Consultório Teste") {
    const res = await as(token).post("/clinics", { name, type: "OWN" });
    expect(res.status).toBe(201);
    return res.body.id as string;
  }

  async function createProcedure(token: string, name = "Procedimento Teste") {
    const res = await as(token).post("/procedures", { name, defaultValue: 100 });
    expect(res.status).toBe(201);
    return res.body.id as string;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();

    await rawPrisma.organization.deleteMany({});
    await rawPrisma.user.deleteMany({});

    orgA = await seedOrgContext(app, "OrgA");
    orgB = await seedOrgContext(app, "OrgB");
  }, 30000);

  afterAll(async () => {
    await rawPrisma.organization.deleteMany({});
    await rawPrisma.user.deleteMany({});
    await rawPrisma.$disconnect();
    await app.close();
  });

  it("Clinic: create em A, GET/PATCH por id em B dão 404; list de B não vaza", async () => {
    const clinicId = await createClinic(orgA.dentistToken, "Clínica A");

    expect((await as(orgB.dentistToken).get(`/clinics/${clinicId}`)).status).toBe(404);
    expect((await as(orgB.dentistToken).patch(`/clinics/${clinicId}`, { name: "Hackeado" })).status).toBe(404);

    const listB = await as(orgB.dentistToken).get("/clinics");
    expect(listB.body.some((c: { id: string }) => c.id === clinicId)).toBe(false);
  });

  it("Patient: create em A, GET/PATCH por id em B dão 404; list de B não vaza", async () => {
    const patientId = await createPatient(orgA.dentistToken, "Paciente A");

    expect((await as(orgB.dentistToken).get(`/patients/${patientId}`)).status).toBe(404);
    expect((await as(orgB.dentistToken).patch(`/patients/${patientId}`, { name: "Hackeado" })).status).toBe(404);

    const listB = await as(orgB.dentistToken).get("/patients");
    expect(listB.body.some((p: { id: string }) => p.id === patientId)).toBe(false);
  });

  it("ProcedureCatalog: create em A, PATCH por id em B dá 404; list de B não vaza", async () => {
    const procedureId = await createProcedure(orgA.dentistToken, "Procedimento A");

    expect((await as(orgB.dentistToken).patch(`/procedures/${procedureId}`, { name: "Hackeado" })).status).toBe(404);

    const listB = await as(orgB.dentistToken).get("/procedures");
    expect(listB.body.some((p: { id: string }) => p.id === procedureId)).toBe(false);
  });

  it("Appointment: create em A, GET/PATCH por id em B dão 404; e criar em B referenciando patient/clinic de A dá 404", async () => {
    const patientIdA = await createPatient(orgA.dentistToken, "Paciente Agenda A");
    const clinicIdA = await createClinic(orgA.dentistToken, "Clínica Agenda A");

    const created = await as(orgA.dentistToken).post("/appointments", {
      patientId: patientIdA,
      clinicId: clinicIdA,
      startsAt: "2027-01-10T13:00:00-03:00",
    });
    expect(created.status).toBe(201);
    const appointmentId = created.body.id;

    expect((await as(orgB.dentistToken).get(`/appointments/${appointmentId}`)).status).toBe(404);
    expect(
      (await as(orgB.dentistToken).patch(`/appointments/${appointmentId}`, { notes: "hackeado" })).status,
    ).toBe(404);

    // FK cross-tenant: Org B tentando criar agendamento com paciente/consultório de Org A
    const crossCreate = await as(orgB.dentistToken).post("/appointments", {
      patientId: patientIdA,
      clinicId: clinicIdA,
      startsAt: "2027-01-11T13:00:00-03:00",
    });
    expect(crossCreate.status).toBe(404);
  });

  it("Budget: create em A, GET por id em B dá 404; nested items ficam escopados; criar em B com patient/procedure de A dá 404", async () => {
    const patientIdA = await createPatient(orgA.dentistToken, "Paciente Orçamento A");
    const procedureIdA = await createProcedure(orgA.dentistToken, "Procedimento Orçamento A");

    const created = await as(orgA.dentistToken).post("/budgets", {
      patientId: patientIdA,
      items: [{ procedureId: procedureIdA, value: 150 }],
    });
    expect(created.status).toBe(201);
    expect(created.body.items[0].organizationId).toBe(orgA.organizationId);
    const budgetId = created.body.id;

    expect((await as(orgB.dentistToken).get(`/budgets/${budgetId}`)).status).toBe(404);
    expect(
      (await as(orgB.dentistToken).patch(`/budgets/${budgetId}/status`, { status: "APPROVED" })).status,
    ).toBe(404);

    const crossCreate = await as(orgB.dentistToken).post("/budgets", {
      patientId: patientIdA,
      items: [{ procedureId: procedureIdA, value: 150 }],
    });
    expect(crossCreate.status).toBe(404);

    const listB = await as(orgB.dentistToken).get(`/budgets?patientId=${patientIdA}`);
    expect(listB.body).toEqual([]);
  });

  it("Attendance: criar em B referenciando patient/clinic/procedure de A dá 404 (FK cross-tenant + propagação em transação)", async () => {
    const patientIdA = await createPatient(orgA.dentistToken, "Paciente Atendimento A");
    const clinicIdA = await createClinic(orgA.dentistToken, "Clínica Atendimento A");
    const procedureIdA = await createProcedure(orgA.dentistToken, "Procedimento Atendimento A");

    const okAsA = await as(orgA.dentistToken).post("/attendances", {
      patientId: patientIdA,
      clinicId: clinicIdA,
      procedureId: procedureIdA,
      date: "2027-01-05",
      grossValue: 200,
      repassePercentage: 50,
      materialCost: 0,
      materialUsages: [],
    });
    expect(okAsA.status).toBe(201);

    const crossCreate = await as(orgB.dentistToken).post("/attendances", {
      patientId: patientIdA,
      clinicId: clinicIdA,
      procedureId: procedureIdA,
      date: "2027-01-06",
      grossValue: 200,
      repassePercentage: 50,
      materialCost: 0,
      materialUsages: [],
    });
    expect(crossCreate.status).toBe(404);

    const listB = await as(orgB.dentistToken).get(`/attendances?patientId=${patientIdA}`);
    expect(listB.body).toEqual([]);
  });

  it("Material: create em A, GET/PATCH/POST batches por id em B dão 404; list de B não vaza", async () => {
    const created = await as(orgA.dentistToken).post("/materials", {
      name: "Material A",
      unit: "un",
      minimumStock: 10,
    });
    expect(created.status).toBe(201);
    const materialId = created.body.id;

    expect((await as(orgB.dentistToken).get(`/materials/${materialId}`)).status).toBe(404);
    expect((await as(orgB.dentistToken).patch(`/materials/${materialId}`, { name: "Hackeado" })).status).toBe(404);
    expect(
      (await as(orgB.dentistToken).post(`/materials/${materialId}/batches`, { quantity: 5 })).status,
    ).toBe(404);

    const listB = await as(orgB.dentistToken).get("/materials");
    expect(listB.body.some((m: { id: string }) => m.id === materialId)).toBe(false);
  });

  it("Recall: create em A, PATCH status por id em B dá 404; criar em B com patient de A dá 404; list de B não vaza", async () => {
    const patientIdA = await createPatient(orgA.dentistToken, "Paciente Retorno A");

    const created = await as(orgA.dentistToken).post("/recalls", {
      patientId: patientIdA,
      dueDate: "2027-06-01",
    });
    expect(created.status).toBe(201);
    const recallId = created.body.id;

    expect((await as(orgB.dentistToken).patch(`/recalls/${recallId}/status`, { status: "DONE" })).status).toBe(404);

    const crossCreate = await as(orgB.dentistToken).post("/recalls", { patientId: patientIdA, dueDate: "2027-06-02" });
    expect(crossCreate.status).toBe(404);

    const listB = await as(orgB.dentistToken).get("/recalls");
    expect(listB.body.some((r: { id: string }) => r.id === recallId)).toBe(false);
  });

  it("Users/Membership: criar em A, list/PATCH por membershipId em B dão vazio/404", async () => {
    const created = await as(orgA.adminToken).post("/users", {
      email: `membro-a-${Date.now()}@test.com`,
      password: TEST_PASSWORD,
      name: "Membro A",
      role: "DENTIST",
    });
    expect(created.status).toBe(201);
    const membershipId = created.body.membershipId;

    const listB = await as(orgB.adminToken).get("/users");
    expect(listB.body.some((m: { membershipId: string }) => m.membershipId === membershipId)).toBe(false);

    expect((await as(orgB.adminToken).patch(`/users/${membershipId}`, { active: false })).status).toBe(404);
    expect(
      (await as(orgB.adminToken).patch(`/users/${membershipId}/password`, { password: TEST_PASSWORD })).status,
    ).toBe(404);
  });
});
