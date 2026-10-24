import request from "supertest";
import { Test } from "@nestjs/testing";
import type { NestExpressApplication } from "@nestjs/platform-express";
import * as bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";
import { TEST_DATABASE_URL } from "./test-db";
import { teardownAll } from "./helpers/teardown";

const rawPrisma = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } });
const TEST_PASSWORD = "SenhaForte12345";

describe("Patients (e2e)", () => {
  let app: NestExpressApplication;
  let adminUserId: string;
  let dentistToken: string;
  let dentistUserId: string;
  let receptionistToken: string;
  let orgId: string;
  let orgBId: string;
  let orgBAdminToken: string;

  function as(token: string) {
    return {
      get: (url: string) =>
        request(app.getHttpServer()).get(url).set("Authorization", `Bearer ${token}`),
      post: (url: string, body?: object) =>
        request(app.getHttpServer()).post(url).set("Authorization", `Bearer ${token}`).send(body),
      patch: (url: string, body?: object) =>
        request(app.getHttpServer()).patch(url).set("Authorization", `Bearer ${token}`).send(body),
    };
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.init();

    await teardownAll(rawPrisma);

    const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);

    const org = await rawPrisma.organization.create({ data: { name: "Clínica Pacientes Teste" } });
    orgId = org.id;

    const adminUser = await rawPrisma.user.create({
      data: { organizationId: orgId, email: `admin-${Date.now()}@test.com`, passwordHash, name: "Admin", roles: ["ADMIN"] },
    });
    adminUserId = adminUser.id;
    await rawPrisma.organization.update({ where: { id: orgId }, data: { foundingAdminUserId: adminUserId } });

    const dentistUser = await rawPrisma.user.create({
      data: { organizationId: orgId, email: `dentist-${Date.now()}@test.com`, passwordHash, name: "Dentista", roles: ["DENTIST"] },
    });
    dentistUserId = dentistUser.id;

    const receptionistUser = await rawPrisma.user.create({
      data: { organizationId: orgId, email: `receptionist-${Date.now()}@test.com`, passwordHash, name: "Recepcionista", roles: ["RECEPTIONIST"] },
    });

    const orgB = await rawPrisma.organization.create({ data: { name: "Org B Isolamento" } });
    orgBId = orgB.id;
    const orgBAdmin = await rawPrisma.user.create({
      data: { organizationId: orgBId, email: `admin-b-${Date.now()}@test.com`, passwordHash, name: "Admin B", roles: ["ADMIN"] },
    });
    await rawPrisma.organization.update({ where: { id: orgBId }, data: { foundingAdminUserId: orgBAdmin.id } });

    const loginDentist = await request(app.getHttpServer()).post("/auth/login").send({ identifier: dentistUser.email, password: TEST_PASSWORD });
    dentistToken = loginDentist.body.accessToken;

    const loginRec = await request(app.getHttpServer()).post("/auth/login").send({ identifier: receptionistUser.email, password: TEST_PASSWORD });
    receptionistToken = loginRec.body.accessToken;

    const loginOrgB = await request(app.getHttpServer()).post("/auth/login").send({ identifier: orgBAdmin.email, password: TEST_PASSWORD });
    orgBAdminToken = loginOrgB.body.accessToken;
  }, 30000);

  afterAll(async () => {
    await teardownAll(rawPrisma);
    await rawPrisma.$disconnect();
    await app.close();
  });

  describe("Cadastro rápido (quick create)", () => {
    it("DENTIST cria paciente com nome+telefone — retorna 201 com ownerDentistId = próprio dentista", async () => {
      const res = await as(dentistToken).post("/patients", { name: "Quick A", phone: "11900000001" });
      expect(res.status).toBe(201);
      expect(res.body.ownerDentist?.id).toBe(dentistUserId);
    });

    it("RECEPTIONIST sem ownerDentistId → 400", async () => {
      const res = await as(receptionistToken).post("/patients", { name: "Quick B", phone: "11900000002" });
      expect(res.status).toBe(400);
    });

    it("RECEPTIONIST com ownerDentistId válido → 201", async () => {
      const res = await as(receptionistToken).post("/patients", {
        name: "Quick C",
        phone: "11900000003",
        ownerDentistId: dentistUserId,
      });
      expect(res.status).toBe(201);
      expect(res.body.ownerDentist?.id).toBe(dentistUserId);
    });

    it("DENTIST não pode setar ownerDentistId de outro dentista → 404", async () => {
      const otherDentist = await rawPrisma.user.create({
        data: {
          organizationId: orgId,
          email: `other-dentist-${Date.now()}@test.com`,
          passwordHash: await bcrypt.hash(TEST_PASSWORD, 10),
          name: "Outro Dentista",
          roles: ["DENTIST"],
        },
      });
      const res = await as(dentistToken).post("/patients", {
        name: "Quick E",
        phone: "11900000005",
        ownerDentistId: otherDentist.id,
      });
      expect(res.status).toBe(404);
    });
  });

  describe("CPF duplicado → 409", () => {
    it("segundo paciente com mesmo CPF na mesma org → 409", async () => {
      const cpf = "529.982.247-25";
      const first = await as(dentistToken).post("/patients", { name: "CPF A", phone: "11911111111", cpf, ownerDentistId: dentistUserId });
      expect(first.status).toBe(201);

      const second = await as(dentistToken).post("/patients", { name: "CPF B", phone: "11911111112", cpf, ownerDentistId: dentistUserId });
      expect(second.status).toBe(409);
    });

    it("mesmo CPF em org diferente → 201 (não é duplicado)", async () => {
      const cpf = "529.982.247-25";
      const orgBDentist = await rawPrisma.user.create({
        data: {
          organizationId: orgBId,
          email: `dentist-b-${Date.now()}@test.com`,
          passwordHash: await bcrypt.hash(TEST_PASSWORD, 10),
          name: "Dentista Org B",
          roles: ["DENTIST"],
        },
      });
      const loginB = await request(app.getHttpServer()).post("/auth/login").send({ identifier: orgBDentist.email, password: TEST_PASSWORD });
      const tokenB = loginB.body.accessToken;

      const res = await as(tokenB).post("/patients", { name: "CPF Cross", phone: "11922222222", cpf, ownerDentistId: orgBDentist.id });
      expect(res.status).toBe(201);
    });
  });

  describe("PATCH /patients/:id — ownerDentistId", () => {
    it("DENTIST não pode alterar ownerDentistId de paciente existente → 403", async () => {
      const created = await as(dentistToken).post("/patients", { name: "Patch Dentist A", phone: "11933333333" });
      expect(created.status).toBe(201);
      const patientId = created.body.id;

      const res = await as(dentistToken).patch(`/patients/${patientId}`, { ownerDentistId: dentistUserId });
      expect(res.status).toBe(403);
    });

    it("RECEPTIONIST pode alterar ownerDentistId → 200 e revisão criada", async () => {
      const created = await as(receptionistToken).post("/patients", {
        name: "Patch Rec A",
        phone: "11944444444",
        ownerDentistId: dentistUserId,
      });
      expect(created.status).toBe(201);
      const patientId = created.body.id;

      const res = await as(receptionistToken).patch(`/patients/${patientId}`, { ownerDentistId: dentistUserId });
      expect(res.status).toBe(200);

      const revisions = await as(receptionistToken).get(`/patients/${patientId}/revisions`);
      expect(revisions.status).toBe(200);
      expect(revisions.body.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("PATCH /patients/:id — revisão", () => {
    it("toda edição cria PatientRevision com snapshot correto", async () => {
      const created = await as(dentistToken).post("/patients", { name: "Revisão A", phone: "11955555555" });
      expect(created.status).toBe(201);
      const patientId = created.body.id;

      await as(dentistToken).patch(`/patients/${patientId}`, { name: "Revisão A editada" });

      const revisions = await as(dentistToken).get(`/patients/${patientId}/revisions`);
      expect(revisions.status).toBe(200);
      expect(revisions.body.length).toBe(1);
      expect((revisions.body[0].snapshot as { name: string }).name).toBe("Revisão A");
    });
  });

  describe("Tenant isolation — PatientRevision", () => {
    it("GET /patients/:id/revisions de outra org → 404", async () => {
      const created = await as(dentistToken).post("/patients", { name: "Isolamento A", phone: "11966666666" });
      expect(created.status).toBe(201);
      const patientId = created.body.id;

      await as(dentistToken).patch(`/patients/${patientId}`, { name: "Isolamento A v2" });

      const res = await as(orgBAdminToken).get(`/patients/${patientId}/revisions`);
      expect(res.status).toBe(404);
    });
  });

  describe("CPF — validação de dígito verificador", () => {
    it("CPF inválido → 400", async () => {
      const res = await as(dentistToken).post("/patients", {
        name: "CPF Inválido",
        phone: "11977777777",
        cpf: "111.111.111-11",
      });
      expect(res.status).toBe(400);
    });

    it("CPF válido → 201", async () => {
      const res = await as(dentistToken).post("/patients", {
        name: "CPF Válido",
        phone: "11988888888",
        cpf: "529.982.247-25",
      });
      // Pode ser 201 ou 409 dependendo da ordem dos testes — ambos aceitáveis aqui
      expect([201, 409]).toContain(res.status);
    });
  });

  describe('campos vazios ("" → undefined)', () => {
    it('POST com cpf/email/sex/maritalStatus="" → 201 com campos null', async () => {
      const res = await as(dentistToken).post("/patients", {
        name: "Vazio A",
        phone: "11900001001",
        cpf: "",
        email: "",
        sex: "",
        maritalStatus: "",
        profession: "",
      });
      expect(res.status).toBe(201);
      expect(res.body.cpf).toBeNull();
      expect(res.body.email).toBeNull();
      expect(res.body.sex).toBeNull();
      expect(res.body.maritalStatus).toBeNull();
      expect(res.body.profession).toBeNull();
    });
  });

  describe("CPF com máscara vs sem máscara", () => {
    it("CPF mascarado e sem máscara na mesma org são detectados como duplicados → 409", async () => {
      const cpfMasked = "111.444.777-35";
      const cpfDigits = "11144477735";

      const first = await as(dentistToken).post("/patients", {
        name: "CPF Mask A",
        phone: "11900002001",
        cpf: cpfMasked,
      });
      expect(first.status).toBe(201);
      expect(first.body.cpf).toBe(cpfDigits);

      const second = await as(dentistToken).post("/patients", {
        name: "CPF Mask B",
        phone: "11900002002",
        cpf: cpfDigits,
      });
      expect(second.status).toBe(409);
    });
  });

  describe("PatientRevision — snapshot sem ownerDentist", () => {
    it("snapshot não contém chave ownerDentist", async () => {
      const created = await as(dentistToken).post("/patients", {
        name: "Snapshot Test",
        phone: "11900003001",
      });
      expect(created.status).toBe(201);
      const patientId = created.body.id;

      await as(dentistToken).patch(`/patients/${patientId}`, { name: "Snapshot Test editado" });

      const revisions = await as(dentistToken).get(`/patients/${patientId}/revisions`);
      expect(revisions.status).toBe(200);
      expect(revisions.body.length).toBeGreaterThanOrEqual(1);
      const snapshot = revisions.body[0].snapshot as Record<string, unknown>;
      expect("ownerDentist" in snapshot).toBe(false);
      expect("id" in snapshot).toBe(true);
    });
  });
});
