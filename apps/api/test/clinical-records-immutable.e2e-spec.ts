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

describe("ClinicalRecords immutable + addendum (e2e)", () => {
  let app: NestExpressApplication;
  let dentistToken: string;
  let receptionistToken: string;
  let orgBDentistToken: string;
  let patientId: string;
  let orgBPatientId: string;
  let recordId: string;

  function as(token: string) {
    const srv = () => request(app.getHttpServer());
    return {
      get: (url: string) => srv().get(url).set("Authorization", `Bearer ${token}`),
      post: (url: string, body?: object) =>
        srv().post(url).set("Authorization", `Bearer ${token}`).send(body),
      put: (url: string, body?: object) =>
        srv().put(url).set("Authorization", `Bearer ${token}`).send(body),
      patch: (url: string, body?: object) =>
        srv().patch(url).set("Authorization", `Bearer ${token}`).send(body),
      delete: (url: string) => srv().delete(url).set("Authorization", `Bearer ${token}`),
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

    // Org A
    const orgA = await rawPrisma.organization.create({ data: { name: "Clínica HAWK H3 A" } });
    const admin = await rawPrisma.user.create({
      data: { organizationId: orgA.id, email: `admin-h3-${ts}@test.com`, passwordHash: hash, name: "Admin H3", roles: ["ADMIN"] },
    });
    await rawPrisma.organization.update({ where: { id: orgA.id }, data: { foundingAdminUserId: admin.id } });
    const dentist = await rawPrisma.user.create({
      data: { organizationId: orgA.id, email: `dent-h3-${ts}@test.com`, passwordHash: hash, name: "Dentista H3", roles: ["DENTIST"] },
    });
    const receptionist = await rawPrisma.user.create({
      data: { organizationId: orgA.id, email: `rec-h3-${ts}@test.com`, passwordHash: hash, name: "Recep H3", roles: ["RECEPTIONIST"] },
    });

    const login = async (email: string) => {
      const res = await request(app.getHttpServer()).post("/auth/login").send({ identifier: email, password: TEST_PASSWORD });
      return res.body.accessToken as string;
    };
    dentistToken = await login(dentist.email);
    receptionistToken = await login(receptionist.email);

    const p = await rawPrisma.patient.create({
      data: { organizationId: orgA.id, name: "Paciente H3", phone: `119${ts}`.slice(0, 11), createdByUserId: dentist.id, ownerDentistId: dentist.id },
    });
    patientId = p.id;

    // Org B
    const orgB = await rawPrisma.organization.create({ data: { name: "Clínica HAWK H3 B" } });
    const adminB = await rawPrisma.user.create({
      data: { organizationId: orgB.id, email: `admin-h3-b-${ts}@test.com`, passwordHash: hash, name: "Admin B", roles: ["ADMIN"] },
    });
    await rawPrisma.organization.update({ where: { id: orgB.id }, data: { foundingAdminUserId: adminB.id } });
    const dentistB = await rawPrisma.user.create({
      data: { organizationId: orgB.id, email: `dent-h3-b-${ts}@test.com`, passwordHash: hash, name: "Dentista B", roles: ["DENTIST"] },
    });
    orgBDentistToken = await login(dentistB.email);
    const pB = await rawPrisma.patient.create({
      data: { organizationId: orgB.id, name: "Paciente Org B H3", phone: `118${ts}`.slice(0, 11), createdByUserId: dentistB.id, ownerDentistId: dentistB.id },
    });
    orgBPatientId = pB.id;
  }, 30000);

  afterAll(async () => {
    await app.close();
    await rawPrisma.$disconnect();
  });

  describe("POST clinical-record → includes empty addenda array", () => {
    it("creates record and returns addenda: []", async () => {
      const res = await as(dentistToken)
        .post(`/patients/${patientId}/clinical-records`, {
          date: new Date().toISOString(),
          procedureNote: "Extração dente 36",
        })
        .expect(201);
      recordId = res.body.id as string;
      expect(res.body.addenda).toEqual([]);
    });
  });

  describe("imutabilidade: sem DELETE/PATCH no record original", () => {
    it("DELETE record → 404 (rota não existe)", async () => {
      await as(dentistToken).delete(`/patients/${patientId}/clinical-records/${recordId}`).expect(404);
    });

    it("PATCH record → 404 (rota não existe)", async () => {
      await as(dentistToken)
        .patch(`/patients/${patientId}/clinical-records/${recordId}`, { procedureNote: "alterado" })
        .expect(404);
    });
  });

  describe("POST addendum", () => {
    it("DENTIST cria adendo → 201 com author e timestamp", async () => {
      const res = await as(dentistToken)
        .post(`/patients/${patientId}/clinical-records/${recordId}/addenda`, { text: "Adendo: paciente tolerou bem" })
        .expect(201);
      expect(res.body.text).toBe("Adendo: paciente tolerou bem");
      expect(res.body.createdBy).toBeDefined();
      expect(res.body.createdAt).toBeDefined();
    });

    it("adendo aparece no GET list", async () => {
      const res = await as(dentistToken).get(`/patients/${patientId}/clinical-records`).expect(200);
      const record = res.body.find((r: { id: string }) => r.id === recordId);
      expect(record).toBeDefined();
      expect(record.addenda.length).toBe(1);
      expect(record.addenda[0].text).toBe("Adendo: paciente tolerou bem");
    });

    it("adendo com text vazio → 400", async () => {
      await as(dentistToken)
        .post(`/patients/${patientId}/clinical-records/${recordId}/addenda`, { text: "" })
        .expect(400);
    });

    it("RECEPTIONIST não pode criar adendo → 403", async () => {
      await as(receptionistToken)
        .post(`/patients/${patientId}/clinical-records/${recordId}/addenda`, { text: "tentativa" })
        .expect(403);
    });

    it("RECEPTIONIST não pode ler clinical-records → 403", async () => {
      await as(receptionistToken).get(`/patients/${patientId}/clinical-records`).expect(403);
    });
  });

  describe("isolamento entre orgs", () => {
    it("dentist org A não pode criar record em paciente org B → 404", async () => {
      await as(dentistToken)
        .post(`/patients/${orgBPatientId}/clinical-records`, {
          date: new Date().toISOString(),
          procedureNote: "cross-tenant",
        })
        .expect(404);
    });

    it("dentist org A não pode criar adendo em paciente org B → 404", async () => {
      // Cria record válido para orgB primeiro
      const res = await as(orgBDentistToken)
        .post(`/patients/${orgBPatientId}/clinical-records`, {
          date: new Date().toISOString(),
          procedureNote: "Org B record",
        })
        .expect(201);
      const orgBRecordId = res.body.id as string;
      await as(dentistToken)
        .post(`/patients/${orgBPatientId}/clinical-records/${orgBRecordId}/addenda`, { text: "cross-tenant adendo" })
        .expect(404);
    });
  });
});
