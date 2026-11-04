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

describe("GET /patients/:id/appointments/summary (e2e)", () => {
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
    const orgA = await rawPrisma.organization.create({ data: { name: `SumOrg A ${ts}` } });
    const admin = await rawPrisma.user.create({
      data: { organizationId: orgA.id, email: `sum-admin-${ts}@test.com`, passwordHash: hash, name: "Admin Sum", roles: ["ADMIN"] },
    });
    await rawPrisma.organization.update({ where: { id: orgA.id }, data: { foundingAdminUserId: admin.id } });

    const dentist = await rawPrisma.user.create({
      data: { organizationId: orgA.id, email: `sum-dent-${ts}@test.com`, passwordHash: hash, name: "Dentista Sum", roles: ["DENTIST"] },
    });
    const receptionist = await rawPrisma.user.create({
      data: { organizationId: orgA.id, email: `sum-rec-${ts}@test.com`, passwordHash: hash, name: "Recep Sum", roles: ["RECEPTIONIST"] },
    });

    const clinic = await rawPrisma.clinic.create({
      data: { organizationId: orgA.id, name: "Consultório Sum", type: "ODONTO" },
    });
    const patient = await rawPrisma.patient.create({
      data: { organizationId: orgA.id, name: "Paciente Sum", phone: "11900000001", ownerDentistId: dentist.id },
    });
    patientId = patient.id;

    const now = new Date();
    const past = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const future = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    await rawPrisma.appointment.create({
      data: {
        organizationId: orgA.id,
        patientId: patient.id,
        clinicId: clinic.id,
        dentistUserId: dentist.id,
        startsAt: past,
        endsAt: new Date(past.getTime() + 60 * 60 * 1000),
        status: "DONE",
      },
    });
    await rawPrisma.appointment.create({
      data: {
        organizationId: orgA.id,
        patientId: patient.id,
        clinicId: clinic.id,
        dentistUserId: dentist.id,
        startsAt: future,
        endsAt: new Date(future.getTime() + 60 * 60 * 1000),
        status: "SCHEDULED",
      },
    });

    // Org B for isolation check
    const orgB = await rawPrisma.organization.create({ data: { name: `SumOrg B ${ts}` } });
    const adminB = await rawPrisma.user.create({
      data: { organizationId: orgB.id, email: `sum-admin-b-${ts}@test.com`, passwordHash: hash, name: "Admin B Sum", roles: ["ADMIN"] },
    });
    await rawPrisma.organization.update({ where: { id: orgB.id }, data: { foundingAdminUserId: adminB.id } });
    const dentistB = await rawPrisma.user.create({
      data: { organizationId: orgB.id, email: `sum-dent-b-${ts}@test.com`, passwordHash: hash, name: "Dentista B Sum", roles: ["DENTIST"] },
    });
    const patientB = await rawPrisma.patient.create({
      data: { organizationId: orgB.id, name: "Paciente B Sum", phone: "11900000002", ownerDentistId: dentistB.id },
    });
    orgBPatientId = patientB.id;

    const login = async (email: string) => {
      const res = await request(app.getHttpServer()).post("/auth/login").send({ identifier: email, password: TEST_PASSWORD });
      return res.body.accessToken as string;
    };
    dentistToken = await login(dentist.email);
    receptionistToken = await login(receptionist.email);
    orgBDentistToken = await login(dentistB.email);
  });

  afterAll(async () => {
    await teardownAll(rawPrisma);
    await app.close();
    await rawPrisma.$disconnect();
  });

  it("DENTIST: returns last and next appointment", async () => {
    const res = await as(dentistToken).get(`/patients/${patientId}/appointments/summary`);
    expect(res.status).toBe(200);
    expect(res.body.last).not.toBeNull();
    expect(res.body.next).not.toBeNull();
    expect(new Date(res.body.last.startsAt).getTime()).toBeLessThan(Date.now());
    expect(new Date(res.body.next.startsAt).getTime()).toBeGreaterThan(Date.now());
  });

  it("RECEPTIONIST: can access summary (registry access)", async () => {
    const res = await as(receptionistToken).get(`/patients/${patientId}/appointments/summary`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("last");
    expect(res.body).toHaveProperty("next");
  });

  it("tenant isolation: org B dentist cannot see org A patient summary", async () => {
    const res = await as(orgBDentistToken).get(`/patients/${patientId}/appointments/summary`);
    expect(res.status).toBe(404);
  });

  it("org B dentist: can see own org patient summary", async () => {
    const res = await as(orgBDentistToken).get(`/patients/${orgBPatientId}/appointments/summary`);
    expect(res.status).toBe(200);
    expect(res.body.last).toBeNull();
    expect(res.body.next).toBeNull();
  });
});
