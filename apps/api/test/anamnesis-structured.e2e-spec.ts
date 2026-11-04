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

describe("Anamnesis structured (e2e)", () => {
  let app: NestExpressApplication;
  let dentistToken: string;
  let receptionistToken: string;
  let orgBDentistToken: string;
  let patientId: string;
  let orgBPatientId: string;

  function as(token: string) {
    const srv = () => request(app.getHttpServer());
    return {
      get: (url: string) => srv().get(url).set("Authorization", `Bearer ${token}`),
      put: (url: string, body?: object) =>
        srv().put(url).set("Authorization", `Bearer ${token}`).send(body),
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
    const orgA = await rawPrisma.organization.create({ data: { name: "Clínica HAWK A" } });
    const admin = await rawPrisma.user.create({
      data: { organizationId: orgA.id, email: `admin-hawk-${ts}@test.com`, passwordHash: hash, name: "Admin A", roles: ["ADMIN"] },
    });
    await rawPrisma.organization.update({ where: { id: orgA.id }, data: { foundingAdminUserId: admin.id } });

    const dentist = await rawPrisma.user.create({
      data: { organizationId: orgA.id, email: `dent-hawk-${ts}@test.com`, passwordHash: hash, name: "Dentista HAWK", roles: ["DENTIST"] },
    });
    const receptionist = await rawPrisma.user.create({
      data: { organizationId: orgA.id, email: `rec-hawk-${ts}@test.com`, passwordHash: hash, name: "Recepcionista HAWK", roles: ["RECEPTIONIST"] },
    });

    const login = async (email: string) => {
      const res = await request(app.getHttpServer()).post("/auth/login").send({ identifier: email, password: TEST_PASSWORD });
      return res.body.accessToken as string;
    };
    dentistToken = await login(dentist.email);
    receptionistToken = await login(receptionist.email);

    const p = await rawPrisma.patient.create({
      data: { organizationId: orgA.id, name: "Paciente HAWK", phone: `119${ts}`.slice(0, 11), createdByUserId: dentist.id, ownerDentistId: dentist.id },
    });
    patientId = p.id;

    // Org B (tenant isolation)
    const orgB = await rawPrisma.organization.create({ data: { name: "Clínica HAWK B" } });
    const adminB = await rawPrisma.user.create({
      data: { organizationId: orgB.id, email: `admin-hawk-b-${ts}@test.com`, passwordHash: hash, name: "Admin B", roles: ["ADMIN"] },
    });
    await rawPrisma.organization.update({ where: { id: orgB.id }, data: { foundingAdminUserId: adminB.id } });
    const dentistB = await rawPrisma.user.create({
      data: { organizationId: orgB.id, email: `dent-hawk-b-${ts}@test.com`, passwordHash: hash, name: "Dentista B", roles: ["DENTIST"] },
    });
    orgBDentistToken = await login(dentistB.email);
    const pB = await rawPrisma.patient.create({
      data: { organizationId: orgB.id, name: "Paciente Org B", phone: `118${ts}`.slice(0, 11), createdByUserId: dentistB.id, ownerDentistId: dentistB.id },
    });
    orgBPatientId = pB.id;
  }, 30000);

  afterAll(async () => {
    await app.close();
    await rawPrisma.$disconnect();
  });

  const validStructured = {
    version: 1 as const,
    answers: {
      hypertension: { value: true, detail: "controlada" },
      diabetes: { value: false },
      heartDisease: { value: false },
      anticoagulant: { value: false },
      allergyAnesthetic: { value: false },
      allergyPenicillin: { value: false },
      allergyLatex: { value: false },
      bleedingProblems: { value: false },
      bisphosphonate: { value: false },
    },
  };

  describe("DENTIST upsert + read", () => {
    it("upserts with structured field → 200 and returns structured", async () => {
      const res = await as(dentistToken)
        .put(`/patients/${patientId}/anamnesis`, {
          chiefComplaint: "Dor molar",
          allergies: "",
          medications: "",
          healthConditions: "",
          dentalHistory: "",
          structured: validStructured,
        })
        .expect(200);
      expect(res.body.structured).toBeDefined();
      expect(res.body.structured.answers.hypertension.value).toBe(true);
    });

    it("reads structured back", async () => {
      const res = await as(dentistToken).get(`/patients/${patientId}/anamnesis`).expect(200);
      expect(res.body.structured.answers.hypertension.value).toBe(true);
      expect(res.body.structured.answers.hypertension.detail).toBe("controlada");
    });

    it("null/undefined answers are not false — stored as given", async () => {
      const res = await as(dentistToken).get(`/patients/${patientId}/anamnesis`).expect(200);
      // smoker was not sent → absent or null, not false
      expect(res.body.structured.answers.smoker ?? null).toBeNull();
    });
  });

  describe("validation: detail required when value=true for specific keys", () => {
    it("heartDisease value=true without detail → 400", async () => {
      await as(dentistToken)
        .put(`/patients/${patientId}/anamnesis`, {
          structured: {
            version: 1,
            answers: { heartDisease: { value: true, detail: "" } },
          },
        })
        .expect(400);
    });

    it("allergyAnesthetic value=true without detail → 400", async () => {
      await as(dentistToken)
        .put(`/patients/${patientId}/anamnesis`, {
          structured: {
            version: 1,
            answers: { allergyAnesthetic: { value: true } },
          },
        })
        .expect(400);
    });

    it("hypertension value=true without detail → 200 (detail not required)", async () => {
      await as(dentistToken)
        .put(`/patients/${patientId}/anamnesis`, {
          structured: { version: 1, answers: { hypertension: { value: true } } },
        })
        .expect(200);
    });
  });

  describe("RECEPTIONIST cannot read or write anamnesis → 403", () => {
    it("GET → 403", async () => {
      await as(receptionistToken).get(`/patients/${patientId}/anamnesis`).expect(403);
    });

    it("PUT → 403", async () => {
      await as(receptionistToken)
        .put(`/patients/${patientId}/anamnesis`, { chiefComplaint: "tentativa" })
        .expect(403);
    });
  });

  describe("tenant isolation", () => {
    it("dentist from org A cannot read org B patient anamnesis → 404", async () => {
      await as(dentistToken).get(`/patients/${orgBPatientId}/anamnesis`).expect(404);
    });

    it("dentist from org A cannot write org B patient anamnesis → 404", async () => {
      await as(dentistToken)
        .put(`/patients/${orgBPatientId}/anamnesis`, { chiefComplaint: "cross-tenant" })
        .expect(404);
    });

    it("dentist from org B can write own patient anamnesis → 200", async () => {
      await as(orgBDentistToken)
        .put(`/patients/${orgBPatientId}/anamnesis`, {
          chiefComplaint: "Org B ok",
          structured: { version: 1, answers: { diabetes: { value: false } } },
        })
        .expect(200);
    });
  });
});
