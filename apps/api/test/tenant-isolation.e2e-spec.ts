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
  dentistUserId: string;
  adminToken: string;
  adminUserId: string;
}

async function seedOrgContext(
  app: INestApplication,
  label: string,
  type: "CLINIC" | "FREELANCER" = "CLINIC",
): Promise<OrgContext> {
  const org = await rawPrisma.organization.create({ data: { name: `${label} (teste isolamento)`, type } });
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);

  const dentistUser = await rawPrisma.user.create({
    data: {
      organizationId: org.id,
      email: `${label}-dentist-${Date.now()}-${Math.random()}@test.com`,
      passwordHash,
      name: `${label} Dentista`,
      role: "DENTIST",
    },
  });

  const adminUser = await rawPrisma.user.create({
    data: {
      organizationId: org.id,
      email: `${label}-admin-${Date.now()}-${Math.random()}@test.com`,
      passwordHash,
      name: `${label} Admin`,
      role: "ADMIN",
    },
  });
  await rawPrisma.organization.update({ where: { id: org.id }, data: { foundingAdminUserId: adminUser.id } });

  const dentistLogin = await request(app.getHttpServer())
    .post("/auth/login")
    .send({ identifier: dentistUser.email, password: TEST_PASSWORD });
  const adminLogin = await request(app.getHttpServer())
    .post("/auth/login")
    .send({ identifier: adminUser.email, password: TEST_PASSWORD });

  return {
    organizationId: org.id,
    dentistToken: dentistLogin.body.accessToken,
    dentistUserId: dentistUser.id,
    adminToken: adminLogin.body.accessToken,
    adminUserId: adminUser.id,
  };
}

describe("Isolamento cross-tenant", () => {
  let app: INestApplication;
  let orgA: OrgContext;
  let orgB: OrgContext;
  let freelancerOrg: OrgContext;

  function as(token: string) {
    const server = () => app.getHttpServer();
    return {
      get: (path: string) => request(server()).get(path).set("Authorization", `Bearer ${token}`),
      post: (path: string, body: Record<string, unknown>) =>
        request(server()).post(path).set("Authorization", `Bearer ${token}`).send(body),
      patch: (path: string, body: Record<string, unknown>) =>
        request(server()).patch(path).set("Authorization", `Bearer ${token}`).send(body),
      put: (path: string, body: Record<string, unknown>) =>
        request(server()).put(path).set("Authorization", `Bearer ${token}`).send(body),
    };
  }

  function noAuth() {
    const server = () => app.getHttpServer();
    return {
      post: (path: string, body: Record<string, unknown>) => request(server()).post(path).send(body),
    };
  }

  async function createPatient(token: string, name = "Paciente Teste") {
    const res = await as(token).post("/patients", { name, phone: "11999999999" });
    expect(res.status).toBe(201);
    return res.body.id as string;
  }

  // Vai direto no Prisma (não via POST /clinics) porque consultório de tenant
  // tipo CLINIC (default dos testes) não é mais self-service — ver
  // ClinicsService.create(). Isso é fixture de teste, não está testando a
  // regra de criação em si.
  async function createClinic(organizationId: string, name = "Consultório Teste") {
    const clinic = await rawPrisma.clinic.create({ data: { organizationId, name, type: "OWN" } });
    return clinic.id;
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
    freelancerOrg = await seedOrgContext(app, "Freelancer", "FREELANCER");
  }, 30000);

  afterAll(async () => {
    await rawPrisma.organization.deleteMany({});
    await rawPrisma.user.deleteMany({});
    await rawPrisma.$disconnect();
    await app.close();
  });

  it("Clinic: create em A, GET/PATCH por id em B dão 404; list de B não vaza", async () => {
    const clinicId = await createClinic(orgA.organizationId, "Clínica A");

    expect((await as(orgB.dentistToken).get(`/clinics/${clinicId}`)).status).toBe(404);
    expect((await as(orgB.dentistToken).patch(`/clinics/${clinicId}`, { name: "Hackeado" })).status).toBe(404);

    const listB = await as(orgB.dentistToken).get("/clinics");
    expect(listB.body.some((c: { id: string }) => c.id === clinicId)).toBe(false);
  });

  it("Clinic: dentista de tenant tipo CLINIC não consegue criar consultório novo (só Freelancer pode)", async () => {
    const res = await as(orgA.dentistToken).post("/clinics", { name: "Consultório Novo", type: "OWN" });
    expect(res.status).toBe(403);
  });

  it("ClinicFinancialTerms: freelancer define, lê e troca o tipo de relação (campos do tipo anterior somem)", async () => {
    const create = await as(freelancerOrg.dentistToken).post("/clinics", {
      name: "Consultório Freelancer",
      type: "OWN",
    });
    expect(create.status).toBe(201);
    const clinicId = create.body.id as string;

    const rented = await as(freelancerOrg.dentistToken).put(`/clinics/${clinicId}/financial-terms`, {
      relationshipType: "RENTED_FIXED",
      rentValue: 300,
      rentPeriodicity: "MONTHLY",
    });
    expect(rented.status).toBe(200);
    expect(rented.body.rentValue).toBe(300);
    expect(rented.body.rentPeriodicity).toBe("MONTHLY");

    const found = await as(freelancerOrg.dentistToken).get(`/clinics/${clinicId}/financial-terms`);
    expect(found.body.relationshipType).toBe("RENTED_FIXED");

    const commission = await as(freelancerOrg.dentistToken).put(`/clinics/${clinicId}/financial-terms`, {
      relationshipType: "COMMISSION",
      commissionPercentage: 30,
    });
    expect(commission.status).toBe(200);
    expect(commission.body.relationshipType).toBe("COMMISSION");
    expect(commission.body.commissionPercentage).toBe(30);
    // Campos do RENTED_FIXED anterior precisam ter sido zerados, não só
    // ignorados.
    expect(commission.body.rentValue).toBeNull();
    expect(commission.body.rentPeriodicity).toBeNull();
  });

  it("ClinicFinancialTerms: dentista de tenant CLINIC recebe 403, mesmo no próprio consultório", async () => {
    const clinicId = await createClinic(orgA.organizationId, "Consultório da Clínica A");
    const res = await as(orgA.dentistToken).put(`/clinics/${clinicId}/financial-terms`, {
      relationshipType: "RENTED_FIXED",
      rentValue: 100,
      rentPeriodicity: "DAILY",
    });
    expect(res.status).toBe(403);
  });

  it("ClinicFinancialTerms: freelancer de outro tenant não consegue definir termos no consultório de outro freelancer (404)", async () => {
    const otherFreelancer = await seedOrgContext(app, "Freelancer B", "FREELANCER");
    const create = await as(freelancerOrg.dentistToken).post("/clinics", {
      name: "Consultório Isolamento",
      type: "OWN",
    });
    expect(create.status).toBe(201);
    const clinicId = create.body.id as string;

    const res = await as(otherFreelancer.dentistToken).put(`/clinics/${clinicId}/financial-terms`, {
      relationshipType: "PER_SERVICE",
      defaultServiceRate: 50,
    });
    expect(res.status).toBe(404);
  });

  it("GET organization/dentists: admin vê o roster da própria org, dentista recebe 403 (RBAC real, não só filtro de UI)", async () => {
    const asAdmin = await as(orgA.adminToken).get("/organization/dentists");
    expect(asAdmin.status).toBe(200);
    expect(asAdmin.body.some((d: { userId: string }) => d.userId === orgA.dentistUserId)).toBe(true);

    const asDentist = await as(orgA.dentistToken).get("/organization/dentists");
    expect(asDentist.status).toBe(403);
  });

  it("GET organization/dentists: isolamento cross-tenant — admin de B não vê dentista de A", async () => {
    const asAdminB = await as(orgB.adminToken).get("/organization/dentists");
    expect(asAdminB.status).toBe(200);
    expect(asAdminB.body.some((d: { userId: string }) => d.userId === orgA.dentistUserId)).toBe(false);
  });

  it("GET organization/dentists: dentista inativo some do roster", async () => {
    const org = await seedOrgContext(app, "InativoTest");
    const dentistUser = await rawPrisma.user.findFirstOrThrow({
      where: { organizationId: org.organizationId, role: "DENTIST" },
    });

    const beforeDeactivation = await as(org.adminToken).get("/organization/dentists");
    expect(beforeDeactivation.body.some((d: { userId: string }) => d.userId === dentistUser.id)).toBe(true);

    await rawPrisma.user.update({ where: { id: dentistUser.id }, data: { active: false } });

    const afterDeactivation = await as(org.adminToken).get("/organization/dentists");
    expect(afterDeactivation.body.some((d: { userId: string }) => d.userId === dentistUser.id)).toBe(false);
  });

  it("POST /clinics e POST /users: colorToken omitido cicla a paleta por índice; informado é respeitado", async () => {
    const org = await seedOrgContext(app, "CorPaleta", "FREELANCER");

    const clinic1 = await as(org.dentistToken).post("/clinics", { name: "Consultório 1", type: "OWN" });
    const clinic2 = await as(org.dentistToken).post("/clinics", { name: "Consultório 2", type: "OWN" });
    expect(clinic1.body.colorToken).toBe("BRAND");
    expect(clinic2.body.colorToken).toBe("SUCCESS");

    const clinicChosen = await as(org.dentistToken).post("/clinics", {
      name: "Consultório Escolhido",
      type: "OWN",
      colorToken: "ERROR",
    });
    expect(clinicChosen.body.colorToken).toBe("ERROR");
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
    const clinicIdA = await createClinic(orgA.organizationId, "Clínica Agenda A");

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
    const clinicIdA = await createClinic(orgA.organizationId, "Clínica Atendimento A");
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

  it("Users: criar em A, list/PATCH por userId em B dão vazio/404", async () => {
    const created = await as(orgA.adminToken).post("/users", {
      email: `membro-a-${Date.now()}@test.com`,
      password: TEST_PASSWORD,
      name: "Membro A",
      role: "DENTIST",
    });
    expect(created.status).toBe(201);
    const userId = created.body.userId;

    const listB = await as(orgB.adminToken).get("/users");
    expect(listB.body.some((u: { userId: string }) => u.userId === userId)).toBe(false);

    expect((await as(orgB.adminToken).patch(`/users/${userId}`, { active: false })).status).toBe(404);
    expect(
      (await as(orgB.adminToken).patch(`/users/${userId}/password`, { password: TEST_PASSWORD })).status,
    ).toBe(404);
  });

  it("Capitania: admin não-fundador não pode editar/desativar outro admin da mesma clínica", async () => {
    const secondAdminEmail = `segundo-admin-${Date.now()}@test.com`;
    const created = await as(orgA.adminToken).post("/users", {
      email: secondAdminEmail,
      password: TEST_PASSWORD,
      name: "Segundo Admin",
      role: "ADMIN",
    });
    expect(created.status).toBe(201);
    const secondAdminUserId = created.body.userId;

    const secondAdminLogin = await noAuth().post("/auth/login", { identifier: secondAdminEmail, password: TEST_PASSWORD });
    const secondAdminToken = secondAdminLogin.body.accessToken;

    // O admin fundador (orgA.adminUserId) pode editar o segundo admin.
    expect(
      (await as(orgA.adminToken).patch(`/users/${secondAdminUserId}`, { active: false })).status,
    ).toBe(200);

    // Reativa antes do próximo teste.
    await as(orgA.adminToken).patch(`/users/${secondAdminUserId}`, { active: true });

    // O segundo admin (não-fundador) NÃO pode editar o admin fundador.
    expect(
      (await as(secondAdminToken).patch(`/users/${orgA.adminUserId}`, { active: false })).status,
    ).toBe(403);
  });

  it("Login multi-tenant: e-mail repetido entre organizations exige organizationId", async () => {
    const sharedEmail = `compartilhado-${Date.now()}@test.com`;
    const createdInA = await as(orgA.adminToken).post("/users", {
      email: sharedEmail,
      password: TEST_PASSWORD,
      name: "Pessoa A",
      role: "DENTIST",
    });
    expect(createdInA.status).toBe(201);
    const createdInB = await as(orgB.adminToken).post("/users", {
      email: sharedEmail,
      password: TEST_PASSWORD,
      name: "Pessoa B",
      role: "DENTIST",
    });
    expect(createdInB.status).toBe(201);

    const lookup = await noAuth().post("/auth/lookup", { identifier: sharedEmail });
    expect(lookup.status).toBe(201);
    expect(lookup.body.requiresOrganizationSelection).toBe(true);
    expect(lookup.body.accounts).toHaveLength(2);

    // Sem organizationId: ambíguo, 401.
    const loginWithoutOrg = await noAuth().post("/auth/login", { identifier: sharedEmail, password: TEST_PASSWORD });
    expect(loginWithoutOrg.status).toBe(401);

    // Com organizationId certo: entra normalmente.
    const loginWithOrg = await noAuth().post("/auth/login", {
      identifier: sharedEmail,
      password: TEST_PASSWORD,
      organizationId: orgA.organizationId,
    });
    expect(loginWithOrg.status).toBe(201);
    expect(loginWithOrg.body.accessToken).toBeTruthy();
  });

  it("Login por nickname: sempre 1:1, nunca pede escolha de organização", async () => {
    const nickname = `apelido-${Date.now()}`;
    await rawPrisma.user.update({
      where: { id: orgA.adminUserId },
      data: { nickname },
    });

    const lookup = await noAuth().post("/auth/lookup", { identifier: nickname });
    expect(lookup.body.requiresOrganizationSelection).toBe(false);

    const login = await noAuth().post("/auth/login", { identifier: nickname, password: TEST_PASSWORD });
    expect(login.status).toBe(201);
    expect(login.body.accessToken).toBeTruthy();
  });

  it("SuperAdminGuard: bloqueia usuário comum em /platform e libera Super Admin", async () => {
    expect((await as(orgA.adminToken).get("/platform/organizations")).status).toBe(403);
    expect((await as(orgA.dentistToken).get("/platform/organizations")).status).toBe(403);

    const superAdminEmail = `super-${Date.now()}@test.com`;
    const superAdminPasswordHash = await bcrypt.hash(TEST_PASSWORD, 10);
    await rawPrisma.user.create({
      data: {
        email: superAdminEmail,
        passwordHash: superAdminPasswordHash,
        name: "Super Admin Teste",
        isSuperAdmin: true,
        organizationId: null,
        role: null,
      },
    });
    const superAdminLogin = await noAuth().post("/auth/login", { identifier: superAdminEmail, password: TEST_PASSWORD });
    const superAdminToken = superAdminLogin.body.accessToken;

    const list = await as(superAdminToken).get("/platform/organizations");
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body)).toBe(true);

    const createOrg = await as(superAdminToken).post("/platform/organizations", {
      name: `Clínica criada pelo Super Admin ${Date.now()}`,
      foundingAdminEmail: `founding-${Date.now()}@test.com`,
      foundingAdminName: "Fundador",
      foundingAdminPassword: TEST_PASSWORD,
    });
    expect(createOrg.status).toBe(201);
    expect(createOrg.body.foundingAdminUserId).toBeTruthy();
  });
});
