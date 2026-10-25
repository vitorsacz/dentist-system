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

describe("GET /appointments — leitura filtrada (e2e)", () => {
  let app: NestExpressApplication;

  // Org A
  let orgAId: string;
  let dentistAToken: string;
  let dentistAId: string;
  let dentistBToken: string;
  let dentistBId: string;
  let adminAToken: string;
  let receptionistAToken: string;
  let clinicAId: string;
  let patientAId: string;

  // Org B (isolamento)
  let adminBToken: string;

  function as(token: string) {
    const srv = () => app.getHttpServer();
    return {
      get: (url: string) => request(srv()).get(url).set("Authorization", `Bearer ${token}`),
      post: (url: string, body?: object) =>
        request(srv()).post(url).set("Authorization", `Bearer ${token}`).send(body),
    };
  }

  async function loginAs(email: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ identifier: email, password: TEST_PASSWORD });
    return res.body.accessToken as string;
  }

  async function seedAppointment(
    dentistId: string,
    startsAt: string,
    endsAt: string,
  ): Promise<string> {
    const appt = await rawPrisma.appointment.create({
      data: {
        organizationId: orgAId,
        patientId: patientAId,
        clinicId: clinicAId,
        dentistUserId: dentistId,
        startsAt: new Date(startsAt),
        endsAt: new Date(endsAt),
      },
    });
    return appt.id;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.init();
    await teardownAll(rawPrisma);

    const hash = await bcrypt.hash(TEST_PASSWORD, 10);
    const ts = Date.now();

    // ── Org A ────────────────────────────────────────────────────────────────
    const orgA = await rawPrisma.organization.create({ data: { name: "Agenda Test Org A" } });
    orgAId = orgA.id;

    const admin = await rawPrisma.user.create({
      data: { organizationId: orgAId, email: `admin-a-${ts}@test.com`, passwordHash: hash, name: "Admin A", roles: ["ADMIN"] },
    });
    await rawPrisma.organization.update({ where: { id: orgAId }, data: { foundingAdminUserId: admin.id } });

    const dentistA = await rawPrisma.user.create({
      data: { organizationId: orgAId, email: `dent-a-${ts}@test.com`, passwordHash: hash, name: "Dentista A", roles: ["DENTIST"] },
    });
    dentistAId = dentistA.id;

    const dentistB = await rawPrisma.user.create({
      data: { organizationId: orgAId, email: `dent-b-${ts}@test.com`, passwordHash: hash, name: "Dentista B", roles: ["DENTIST"] },
    });
    dentistBId = dentistB.id;

    const receptionist = await rawPrisma.user.create({
      data: { organizationId: orgAId, email: `rec-a-${ts}@test.com`, passwordHash: hash, name: "Recepcionista A", roles: ["RECEPTIONIST"] },
    });

    adminAToken = await loginAs(admin.email);
    dentistAToken = await loginAs(dentistA.email);
    dentistBToken = await loginAs(dentistB.email);
    receptionistAToken = await loginAs(receptionist.email);

    const clinic = await rawPrisma.clinic.create({ data: { organizationId: orgAId, name: "Clínica A", type: "OWN" } });
    clinicAId = clinic.id;

    const patient = await rawPrisma.patient.create({
      data: { organizationId: orgAId, name: "Paciente A", phone: "11999990001", createdByUserId: dentistA.id },
    });
    patientAId = patient.id;

    // ── Org B ────────────────────────────────────────────────────────────────
    const orgB = await rawPrisma.organization.create({ data: { name: "Agenda Test Org B" } });
    const adminB = await rawPrisma.user.create({
      data: { organizationId: orgB.id, email: `admin-b-${ts}@test.com`, passwordHash: hash, name: "Admin B", roles: ["ADMIN"] },
    });
    await rawPrisma.organization.update({ where: { id: orgB.id }, data: { foundingAdminUserId: adminB.id } });
    adminBToken = await loginAs(adminB.email);
  }, 30000);

  afterAll(async () => {
    await app.close();
    await rawPrisma.$disconnect();
  });

  // ── Janela de 42 dias ──────────────────────────────────────────────────────

  it("rejeita janela > 42 dias com 422", async () => {
    const from = "2027-01-01T00:00:00.000Z";
    const to = "2027-02-13T00:00:00.000Z"; // 43 dias
    const res = await as(dentistAToken).get(`/appointments?from=${from}&to=${to}`);
    expect(res.status).toBe(422);
  });

  it("aceita janela de exatamente 42 dias", async () => {
    const from = "2027-01-01T00:00:00.000Z";
    const to = "2027-02-12T00:00:00.000Z"; // 42 dias
    const res = await as(dentistAToken).get(`/appointments?from=${from}&to=${to}`);
    expect(res.status).toBe(200);
  });

  it("rejeita sem from/to com 400", async () => {
    const res = await as(dentistAToken).get("/appointments");
    expect(res.status).toBe(400);
  });

  // ── Escopo de dentista ─────────────────────────────────────────────────────

  it("DENTIST vê só a própria agenda, mesmo passando ?dentistUserId de outro", async () => {
    const apptA = await seedAppointment(dentistAId, "2027-03-10T09:00:00Z", "2027-03-10T09:30:00Z");
    const apptB = await seedAppointment(dentistBId, "2027-03-10T10:00:00Z", "2027-03-10T10:30:00Z");

    const from = "2027-03-10T00:00:00Z";
    const to = "2027-03-10T23:59:59Z";

    // Dentista A sem filtro — só vê o próprio
    const resA = await as(dentistAToken).get(`/appointments?from=${from}&to=${to}`);
    expect(resA.status).toBe(200);
    const idsA = resA.body.map((a: { id: string }) => a.id);
    expect(idsA).toContain(apptA);
    expect(idsA).not.toContain(apptB);

    // Dentista A passando ?dentistUserId=dentistB — servidor ignora, ainda só vê o próprio
    const resACross = await as(dentistAToken).get(
      `/appointments?from=${from}&to=${to}&dentistUserId=${dentistBId}`,
    );
    expect(resACross.status).toBe(200);
    const idsACross = resACross.body.map((a: { id: string }) => a.id);
    expect(idsACross).toContain(apptA);
    expect(idsACross).not.toContain(apptB);

    // Dentista B — só vê o próprio
    const resB = await as(dentistBToken).get(`/appointments?from=${from}&to=${to}`);
    expect(resB.status).toBe(200);
    const idsB = resB.body.map((a: { id: string }) => a.id);
    expect(idsB).toContain(apptB);
    expect(idsB).not.toContain(apptA);
  });

  // ── ADMIN e RECEPTIONIST veem todos ───────────────────────────────────────

  it("ADMIN vê todos os agendamentos e pode filtrar por dentistUserId", async () => {
    const apptA = await seedAppointment(dentistAId, "2027-04-01T09:00:00Z", "2027-04-01T09:30:00Z");
    const apptB = await seedAppointment(dentistBId, "2027-04-01T10:00:00Z", "2027-04-01T10:30:00Z");

    const from = "2027-04-01T00:00:00Z";
    const to = "2027-04-01T23:59:59Z";

    const resAll = await as(adminAToken).get(`/appointments?from=${from}&to=${to}`);
    expect(resAll.status).toBe(200);
    const allIds = resAll.body.map((a: { id: string }) => a.id);
    expect(allIds).toContain(apptA);
    expect(allIds).toContain(apptB);

    // Filtrado por dentistA
    const resFiltered = await as(adminAToken).get(
      `/appointments?from=${from}&to=${to}&dentistUserId=${dentistAId}`,
    );
    expect(resFiltered.status).toBe(200);
    const filteredIds = resFiltered.body.map((a: { id: string }) => a.id);
    expect(filteredIds).toContain(apptA);
    expect(filteredIds).not.toContain(apptB);
  });

  it("RECEPTIONIST vê todos os agendamentos", async () => {
    const apptA = await seedAppointment(dentistAId, "2027-05-01T09:00:00Z", "2027-05-01T09:30:00Z");
    const apptB = await seedAppointment(dentistBId, "2027-05-01T10:00:00Z", "2027-05-01T10:30:00Z");

    const from = "2027-05-01T00:00:00Z";
    const to = "2027-05-01T23:59:59Z";

    const res = await as(receptionistAToken).get(`/appointments?from=${from}&to=${to}`);
    expect(res.status).toBe(200);
    const ids = res.body.map((a: { id: string }) => a.id);
    expect(ids).toContain(apptA);
    expect(ids).toContain(apptB);
  });

  // ── Isolamento entre organizações ─────────────────────────────────────────

  it("Org B não vê agendamentos da Org A", async () => {
    const apptA = await seedAppointment(dentistAId, "2027-06-01T09:00:00Z", "2027-06-01T09:30:00Z");

    const from = "2027-06-01T00:00:00Z";
    const to = "2027-06-01T23:59:59Z";

    const res = await as(adminBToken).get(`/appointments?from=${from}&to=${to}`);
    expect(res.status).toBe(200);
    const ids = res.body.map((a: { id: string }) => a.id);
    expect(ids).not.toContain(apptA);
  });
});
