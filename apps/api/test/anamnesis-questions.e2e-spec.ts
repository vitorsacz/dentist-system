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

describe("AnamnesisQuestions (e2e)", () => {
  let app: NestExpressApplication;
  let adminToken: string;
  let receptionistToken: string;
  let orgBAdminToken: string;

  function as(token: string) {
    const srv = () => request(app.getHttpServer());
    return {
      get: (url: string) => srv().get(url).set("Authorization", `Bearer ${token}`),
      post: (url: string, body?: object) =>
        srv().post(url).set("Authorization", `Bearer ${token}`).send(body),
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
    const orgA = await rawPrisma.organization.create({ data: { name: "Clínica AQ A" } });
    const admin = await rawPrisma.user.create({
      data: { organizationId: orgA.id, email: `admin-aq-${ts}@test.com`, passwordHash: hash, name: "Admin AQ", roles: ["ADMIN"] },
    });
    await rawPrisma.organization.update({ where: { id: orgA.id }, data: { foundingAdminUserId: admin.id } });
    const receptionist = await rawPrisma.user.create({
      data: { organizationId: orgA.id, email: `rec-aq-${ts}@test.com`, passwordHash: hash, name: "Recepcionista AQ", roles: ["RECEPTIONIST"] },
    });

    const login = async (email: string) => {
      const res = await request(app.getHttpServer()).post("/auth/login").send({ identifier: email, password: TEST_PASSWORD });
      return res.body.accessToken as string;
    };
    adminToken = await login(admin.email);
    receptionistToken = await login(receptionist.email);

    // Org B (tenant isolation)
    const orgB = await rawPrisma.organization.create({ data: { name: "Clínica AQ B" } });
    const adminB = await rawPrisma.user.create({
      data: { organizationId: orgB.id, email: `admin-aq-b-${ts}@test.com`, passwordHash: hash, name: "Admin B AQ", roles: ["ADMIN"] },
    });
    await rawPrisma.organization.update({ where: { id: orgB.id }, data: { foundingAdminUserId: adminB.id } });
    orgBAdminToken = await login(adminB.email);
  });

  afterAll(async () => {
    await rawPrisma.$disconnect();
    await app.close();
  });

  describe("GET /anamnesis-questions", () => {
    it("ADMIN lists empty initially", async () => {
      const res = await as(adminToken).get("/anamnesis-questions");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it("RECEPTIONIST gets 403", async () => {
      const res = await as(receptionistToken).get("/anamnesis-questions");
      expect(res.status).toBe(403);
    });
  });

  describe("GET /anamnesis-questions/library", () => {
    it("returns 43 questions", async () => {
      const res = await as(adminToken).get("/anamnesis-questions/library");
      expect(res.status).toBe(200);
      expect(res.body.length).toBe(43);
    });

    it("RECEPTIONIST gets 403", async () => {
      const res = await as(receptionistToken).get("/anamnesis-questions/library");
      expect(res.status).toBe(403);
    });
  });

  describe("POST /anamnesis-questions/seed-library", () => {
    it("seeds 43 questions", async () => {
      const res = await as(adminToken).post("/anamnesis-questions/seed-library");
      expect(res.status).toBe(201);
      expect(res.body.created).toBe(43);
    });

    it("idempotent: second seed creates 0", async () => {
      const res = await as(adminToken).post("/anamnesis-questions/seed-library");
      expect(res.status).toBe(201);
      expect(res.body.created).toBe(0);
    });

    it("list returns 43 after seed", async () => {
      const res = await as(adminToken).get("/anamnesis-questions");
      expect(res.status).toBe(200);
      expect(res.body.length).toBe(43);
    });

    it("re-seed after soft-delete reactivates question (no unique violation)", async () => {
      // soft-delete a library question
      const list = await as(adminToken).get("/anamnesis-questions");
      const hypertension = (list.body as Array<{ id: string; key: string }>).find((q) => q.key === "hypertension")!;
      await as(adminToken).delete(`/anamnesis-questions/${hypertension.id}`);

      // confirm removed from list
      const afterDelete = await as(adminToken).get("/anamnesis-questions");
      expect((afterDelete.body as Array<{ key: string }>).some((q) => q.key === "hypertension")).toBe(false);

      // re-seed — must NOT fail with unique constraint
      const res = await as(adminToken).post("/anamnesis-questions/seed-library");
      expect(res.status).toBe(201);
      expect(res.body.reactivated).toBe(1);
      expect(res.body.created).toBe(0);

      // confirm back in list
      const afterReseed = await as(adminToken).get("/anamnesis-questions");
      expect((afterReseed.body as Array<{ key: string }>).some((q) => q.key === "hypertension")).toBe(true);
    });
  });

  describe("POST /anamnesis-questions", () => {
    let createdId: string;

    it("ADMIN creates custom question", async () => {
      const res = await as(adminToken).post("/anamnesis-questions", {
        key: "customQuestion",
        label: "Pergunta customizada?",
        kind: "YES_NO",
        alertWhenYes: false,
        detailRequiredWhenYes: false,
        sensitive: false,
        active: true,
      });
      expect(res.status).toBe(201);
      expect(res.body.key).toBe("customQuestion");
      createdId = res.body.id as string;
    });

    it("duplicate key returns 409", async () => {
      const res = await as(adminToken).post("/anamnesis-questions", {
        key: "customQuestion",
        label: "Duplicada",
      });
      expect(res.status).toBe(409);
    });

    it("Org B does not see Org A question", async () => {
      const res = await as(orgBAdminToken).get("/anamnesis-questions");
      expect(res.status).toBe(200);
      const ids = (res.body as Array<{ id: string }>).map((q) => q.id);
      expect(ids).not.toContain(createdId);
    });

    it("RECEPTIONIST gets 403", async () => {
      const res = await as(receptionistToken).post("/anamnesis-questions", { key: "x", label: "x" });
      expect(res.status).toBe(403);
    });
  });

  describe("PATCH /anamnesis-questions/:id", () => {
    let qId: string;

    beforeAll(async () => {
      const res = await as(adminToken).post("/anamnesis-questions", {
        key: "patchTarget",
        label: "Para editar",
      });
      qId = res.body.id as string;
    });

    it("ADMIN updates label", async () => {
      const res = await as(adminToken).patch(`/anamnesis-questions/${qId}`, { label: "Editado" });
      expect(res.status).toBe(200);
      expect(res.body.label).toBe("Editado");
    });

    it("Org B cannot update Org A question (404)", async () => {
      const res = await as(orgBAdminToken).patch(`/anamnesis-questions/${qId}`, { label: "Hack" });
      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /anamnesis-questions/:id/active", () => {
    let qId: string;
    let originalActive: boolean;

    beforeAll(async () => {
      const res = await as(adminToken).post("/anamnesis-questions", {
        key: "toggleTarget",
        label: "Para toggle",
        active: true,
      });
      qId = res.body.id as string;
      originalActive = res.body.active as boolean;
    });

    it("toggles active", async () => {
      const res = await as(adminToken).patch(`/anamnesis-questions/${qId}/active`);
      expect(res.status).toBe(200);
      expect(res.body.active).toBe(!originalActive);
    });

    it("Org B cannot toggle Org A question (404)", async () => {
      const res = await as(orgBAdminToken).patch(`/anamnesis-questions/${qId}/active`);
      expect(res.status).toBe(404);
    });
  });

  describe("POST /anamnesis-questions/reorder", () => {
    it("reorders own questions", async () => {
      const list = await as(adminToken).get("/anamnesis-questions");
      const ids = (list.body as Array<{ id: string }>).map((q) => q.id).slice(0, 3).reverse();
      const res = await as(adminToken).post("/anamnesis-questions/reorder", { ids });
      expect(res.status).toBe(201);
      const reordered = (res.body as Array<{ id: string }>).slice(0, 3).map((q) => q.id);
      expect(reordered).toEqual(ids);
    });

    it("Org B cannot reorder Org A questions (404)", async () => {
      const list = await as(adminToken).get("/anamnesis-questions");
      const ids = (list.body as Array<{ id: string }>).map((q) => q.id).slice(0, 2);
      const res = await as(orgBAdminToken).post("/anamnesis-questions/reorder", { ids });
      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /anamnesis-questions/:id", () => {
    let qId: string;

    beforeAll(async () => {
      const res = await as(adminToken).post("/anamnesis-questions", {
        key: "deleteTarget",
        label: "Para deletar",
      });
      qId = res.body.id as string;
    });

    it("Org B cannot delete Org A question (404)", async () => {
      const res = await as(orgBAdminToken).delete(`/anamnesis-questions/${qId}`);
      expect(res.status).toBe(404);
    });

    it("ADMIN soft-deletes", async () => {
      const res = await as(adminToken).delete(`/anamnesis-questions/${qId}`);
      expect(res.status).toBe(200);
    });

    it("deleted question absent from list", async () => {
      const res = await as(adminToken).get("/anamnesis-questions");
      const ids = (res.body as Array<{ id: string }>).map((q) => q.id);
      expect(ids).not.toContain(qId);
    });

    it("double-delete returns 404", async () => {
      const res = await as(adminToken).delete(`/anamnesis-questions/${qId}`);
      expect(res.status).toBe(404);
    });
  });

  describe("sensitive questions default inactive", () => {
    it("hiv/hepatitisB/hepatitisC/std seeded with active=false", async () => {
      const res = await as(adminToken).get("/anamnesis-questions");
      const sensitive = (res.body as Array<{ key: string; active: boolean; sensitive: boolean }>).filter(
        (q) => q.sensitive,
      );
      expect(sensitive.length).toBe(4);
      expect(sensitive.every((q) => !q.active)).toBe(true);
    });
  });
});
