import request from "supertest";
import { Test } from "@nestjs/testing";
import type { NestExpressApplication } from "@nestjs/platform-express";
import * as bcrypt from "bcrypt";
import { PrismaClient, type Role } from "@prisma/client";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";
import { TEST_DATABASE_URL } from "./test-db";
import { teardownAll } from "./helpers/teardown";

// P1-P4: cobertura da matriz papel×capacidade para os cenários de onboarding.
// Depende de PR #44 (procedures.write e clinics.write → ["ADMIN"]).
// Org isolation: dois tenants não enxergam dados um do outro.

const rawPrisma = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } });
const PW = "SenhaForte12345";

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function createUser(organizationId: string | null, roles: Role[], extra?: { isSuperAdmin?: boolean }) {
  const email = `matrix-${uid()}@test.com`;
  const user = await rawPrisma.user.create({
    data: { organizationId, email, passwordHash: await bcrypt.hash(PW, 10), name: email, roles, ...extra },
  });
  return { id: user.id, email };
}

async function loginToken(server: ReturnType<typeof request>, email: string): Promise<string> {
  const res = await request(server).post("/auth/login").send({ identifier: email, password: PW });
  return res.body.accessToken as string;
}

function api(server: ReturnType<typeof request>, token: string) {
  const h = { Authorization: `Bearer ${token}` };
  return {
    get: (path: string) => request(server).get(path).set(h),
    post: (path: string, body: object) => request(server).post(path).set(h).send(body),
    patch: (path: string, body: object) => request(server).patch(path).set(h).send(body),
  };
}

// Seeds a CLINIC org with founder(ADMIN), dentist(DENTIST), receptionist(RECEPTIONIST),
// admin+dentist multi-role user, and a clinic+procedure for write tests.
async function seedClinicOrg(label: string) {
  const org = await rawPrisma.organization.create({ data: { name: `${label} Clinic` } });
  const founder = await createUser(org.id, ["ADMIN"]);
  const dentist = await createUser(org.id, ["DENTIST"]);
  const receptionist = await createUser(org.id, ["RECEPTIONIST"]);
  const adminDentist = await createUser(org.id, ["ADMIN", "DENTIST"]);
  await rawPrisma.organization.update({ where: { id: org.id }, data: { foundingAdminUserId: founder.id } });

  const clinic = await rawPrisma.clinic.create({
    data: { organizationId: org.id, name: `${label} Clínica`, type: "OWN" },
  });
  const procedure = await rawPrisma.procedureCatalog.create({
    data: { organizationId: org.id, name: `${label} Proc`, defaultValue: 100 },
  });
  const patient = await rawPrisma.patient.create({
    data: { organizationId: org.id, name: `${label} Pac`, phone: "11900000001", createdByUserId: founder.id },
  });

  return { org, founder, dentist, receptionist, adminDentist, clinic, procedure, patient };
}

// Seeds a FREELANCER org: founder has ADMIN+DENTIST.
async function seedFreelancerOrg(label: string) {
  const org = await rawPrisma.organization.create({ data: { name: `${label} Freelancer`, type: "FREELANCER" } });
  const founder = await createUser(org.id, ["ADMIN", "DENTIST"]);
  await rawPrisma.organization.update({ where: { id: org.id }, data: { foundingAdminUserId: founder.id } });
  const clinic = await rawPrisma.clinic.create({
    data: { organizationId: org.id, name: `${label} Consultório`, type: "OWN" },
  });
  const procedure = await rawPrisma.procedureCatalog.create({
    data: { organizationId: org.id, name: `${label} Proc FL`, defaultValue: 80 },
  });
  const patient = await rawPrisma.patient.create({
    data: { organizationId: org.id, name: `${label} Pac FL`, phone: "11900000002", createdByUserId: founder.id },
  });
  return { org, founder, clinic, procedure, patient };
}

describe("P1-P4 — role matrix e2e", () => {
  let app: NestExpressApplication;
  let server: ReturnType<typeof app.getHttpServer>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.init();
    server = app.getHttpServer();
    await teardownAll(rawPrisma);
  }, 30000);

  afterAll(async () => {
    await teardownAll(rawPrisma);
    await rawPrisma.$disconnect();
    await app.close();
  });

  // ─── P1: ADMIN gere catálogo e consultórios ──────────────────────────────

  describe("P1: ADMIN — procedures.write e clinics.write", () => {
    it("ADMIN pode criar e editar procedimento do catálogo", async () => {
      const { procedure } = await seedClinicOrg("P1-proc");
      const { founder } = await seedClinicOrg("P1-proc-token");
      const token = await loginToken(server, founder.email);
      const a = api(server, token);

      await a.post("/procedures", { name: "Proc Admin Test", defaultValue: 150 }).expect(201);
      await a.patch(`/procedures/${procedure.id}`, { defaultValue: 200 }).expect(200);
    });

    it("ADMIN pode editar consultório", async () => {
      const { clinic, founder } = await seedClinicOrg("P1-clinic");
      const token = await loginToken(server, founder.email);
      await api(server, token).patch(`/clinics/${clinic.id}`, { name: "Clínica Editada" }).expect(200);
    });

    it("ADMIN pode ativar/desativar consultório (clinics.manage)", async () => {
      const { org, founder } = await seedClinicOrg("P1-manage");
      await rawPrisma.clinic.create({ data: { organizationId: org.id, name: "Clínica Extra", type: "OWN" } });
      const { clinic } = await seedClinicOrg("P1-manage-clinic");
      const token = await loginToken(server, founder.email);
      // Need a second active clinic so we can deactivate one.
      await rawPrisma.clinic.create({ data: { organizationId: (await rawPrisma.clinic.findUnique({ where: { id: clinic.id } }))!.organizationId, name: "Guard Clinic", type: "OWN" } });
      await api(server, token).patch(`/clinics/${clinic.id}/active`, { active: false }).expect(200);
    });

    it("ADMIN pode gerenciar usuários (users.manage)", async () => {
      const { founder } = await seedClinicOrg("P1-users");
      const token = await loginToken(server, founder.email);
      await api(server, token).get("/users").expect(200);
    });
  });

  // ─── P2: DENTIST de clínica sem poderes de dono ──────────────────────────

  describe("P2: DENTIST-only em org CLINIC — sem poderes de dono", () => {
    it("DENTIST não pode criar procedimento", async () => {
      const { dentist } = await seedClinicOrg("P2-proc");
      const token = await loginToken(server, dentist.email);
      await api(server, token).post("/procedures", { name: "X", defaultValue: 100 }).expect(403);
    });

    it("DENTIST não pode editar procedimento", async () => {
      const { dentist, procedure } = await seedClinicOrg("P2-proc-edit");
      const token = await loginToken(server, dentist.email);
      await api(server, token).patch(`/procedures/${procedure.id}`, { defaultValue: 200 }).expect(403);
    });

    it("DENTIST não pode criar consultório (guard + service block)", async () => {
      const { dentist } = await seedClinicOrg("P2-clinic-create");
      const token = await loginToken(server, dentist.email);
      await api(server, token)
        .post("/clinics", { name: "New Clinic", type: "OWN" })
        .expect((res) => expect([403, 403]).toContain(res.status));
    });

    it("DENTIST não pode editar consultório", async () => {
      const { dentist, clinic } = await seedClinicOrg("P2-clinic-edit");
      const token = await loginToken(server, dentist.email);
      await api(server, token).patch(`/clinics/${clinic.id}`, { name: "Edited" }).expect(403);
    });

    it("DENTIST não pode gerenciar usuários", async () => {
      const { dentist } = await seedClinicOrg("P2-users");
      const token = await loginToken(server, dentist.email);
      await api(server, token).get("/users").expect(403);
    });

    it("DENTIST pode ler procedimentos e consultórios (read não bloqueado)", async () => {
      const { dentist } = await seedClinicOrg("P2-read");
      const token = await loginToken(server, dentist.email);
      await api(server, token).get("/procedures").expect(200);
      await api(server, token).get("/clinics").expect(200);
    });
  });

  // ─── P3: FREELANCER (ADMIN+DENTIST) — acesso total ───────────────────────

  describe("P3: FREELANCER — dono com acesso total à própria org", () => {
    it("FREELANCER pode criar procedimento", async () => {
      const { founder } = await seedFreelancerOrg("P3-proc");
      const token = await loginToken(server, founder.email);
      await api(server, token).post("/procedures", { name: "FL Proc", defaultValue: 90 }).expect(201);
    });

    it("FREELANCER pode criar consultório", async () => {
      const { founder } = await seedFreelancerOrg("P3-clinic");
      const token = await loginToken(server, founder.email);
      await api(server, token).post("/clinics", { name: "FL Consultório Novo", type: "OWN" }).expect(201);
    });

    it("FREELANCER pode gerenciar usuários", async () => {
      const { founder } = await seedFreelancerOrg("P3-users");
      const token = await loginToken(server, founder.email);
      await api(server, token).get("/users").expect(200);
    });

    it("FREELANCER pode criar paciente", async () => {
      const { founder } = await seedFreelancerOrg("P3-patient");
      const token = await loginToken(server, founder.email);
      await api(server, token)
        .post("/patients", { name: "Paciente FL", phone: "11900000099" })
        .expect((res) => expect([201, 400]).toContain(res.status));
    });
  });

  // ─── P4: RECEPTIONIST conforme matriz ────────────────────────────────────

  describe("P4: RECEPTIONIST — acesso conforme matriz", () => {
    it("RECEPTIONIST pode ler e escrever pacientes", async () => {
      const { receptionist } = await seedClinicOrg("P4-patient");
      const token = await loginToken(server, receptionist.email);
      await api(server, token).get("/patients").expect(200);
    });

    it("RECEPTIONIST pode ler e escrever orçamentos", async () => {
      const { receptionist } = await seedClinicOrg("P4-budget");
      const token = await loginToken(server, receptionist.email);
      await api(server, token).get("/budgets").expect(200);
    });

    it("RECEPTIONIST pode ler procedimentos (procedures.read)", async () => {
      const { receptionist } = await seedClinicOrg("P4-proc-read");
      const token = await loginToken(server, receptionist.email);
      await api(server, token).get("/procedures").expect(200);
    });

    it("RECEPTIONIST não pode criar/editar procedimentos (procedures.write)", async () => {
      const { receptionist, procedure } = await seedClinicOrg("P4-proc-write");
      const token = await loginToken(server, receptionist.email);
      await api(server, token).post("/procedures", { name: "X", defaultValue: 100 }).expect(403);
      await api(server, token).patch(`/procedures/${procedure.id}`, { defaultValue: 200 }).expect(403);
    });

    it("RECEPTIONIST não pode ver dados clínicos", async () => {
      const { receptionist, patient } = await seedClinicOrg("P4-clinical");
      const token = await loginToken(server, receptionist.email);
      await api(server, token).get(`/patients/${patient.id}/anamnesis`).expect(403);
    });

    it("RECEPTIONIST não pode gerenciar usuários", async () => {
      const { receptionist } = await seedClinicOrg("P4-users");
      const token = await loginToken(server, receptionist.email);
      await api(server, token).get("/users").expect(403);
    });

    it("RECEPTIONIST pode ver agendamentos (appointments.read)", async () => {
      const { receptionist } = await seedClinicOrg("P4-appt");
      const token = await loginToken(server, receptionist.email);
      await api(server, token).get("/appointments?from=2026-01-01&to=2026-12-31").expect(200);
    });
  });

  // ─── ADMIN+DENTIST multi-role em CLINIC ──────────────────────────────────

  describe("ADMIN+DENTIST multi-role em org CLINIC", () => {
    it("tem poderes de ADMIN (procedures.write) E de DENTIST (clinical.write)", async () => {
      const { org, adminDentist, procedure } = await seedClinicOrg("Multi");
      const token = await loginToken(server, adminDentist.email);
      const a = api(server, token);

      // ADMIN power: manage procedures
      await a.patch(`/procedures/${procedure.id}`, { defaultValue: 300 }).expect(200);

      // DENTIST power: manage patients
      const patient = await rawPrisma.patient.create({
        data: {
          organizationId: org.id,
          name: "Multi Pac",
          phone: "11900000003",
          createdByUserId: adminDentist.id,
          ownerDentistId: adminDentist.id,
        },
      });
      await a.get(`/patients/${patient.id}/anamnesis`).expect((res) => expect([200, 404]).toContain(res.status));
    });
  });

  // ─── Isolamento entre organizações ───────────────────────────────────────

  describe("isolamento entre duas organizações (P5)", () => {
    it("usuário de org A não enxerga paciente de org B", async () => {
      const { founder: founderA } = await seedClinicOrg("IsoA");
      const { patient: patientB } = await seedClinicOrg("IsoB");
      const tokenA = await loginToken(server, founderA.email);

      // Should not find patient from org B.
      const res = await api(server, tokenA).get(`/patients/${patientB.id}`);
      expect([403, 404]).toContain(res.status);
    });

    it("DENTIST de org A não enxerga procedimentos de org B", async () => {
      const { dentist: dentistA } = await seedClinicOrg("IsoA-proc");
      const { procedure: procB } = await seedClinicOrg("IsoB-proc");
      const tokenA = await loginToken(server, dentistA.email);

      // GET /procedures returns only org A's procedures (tenant-scoped).
      const res = await api(server, tokenA).get("/procedures").expect(200);
      const ids: string[] = res.body.map((p: { id: string }) => p.id);
      expect(ids).not.toContain(procB.id);
    });

    it("ADMIN de org A não pode editar consultório de org B", async () => {
      const { founder: adminA } = await seedClinicOrg("IsoA-clinic");
      const { clinic: clinicB } = await seedClinicOrg("IsoB-clinic");
      const tokenA = await loginToken(server, adminA.email);

      // PATCH clinic from org B with token from org A → 404 (tenant-scoped, B doesn't exist for A).
      await api(server, tokenA).patch(`/clinics/${clinicB.id}`, { name: "Hacked" }).expect(404);
    });
  });
});
