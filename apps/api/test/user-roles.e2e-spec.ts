import request from "supertest";
import { Test } from "@nestjs/testing";
import type { NestExpressApplication } from "@nestjs/platform-express";
import * as bcrypt from "bcrypt";
import { PrismaClient, type Role } from "@prisma/client";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";
import { TEST_DATABASE_URL } from "./test-db";

// Múltiplos papéis por usuário (R1). A permissão vem de QUALQUER um dos
// papéis; as regras de gestão de usuários (users.service) valem pra lista.

const rawPrisma = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } });
const PASSWORD = "SenhaForte12345";
const MONTH = "from=2026-09-01&to=2026-09-30";

describe("Múltiplos papéis por usuário", () => {
  let app: NestExpressApplication;
  const server = () => app.getHttpServer();
  const unique = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  async function createOrg(label: string) {
    return rawPrisma.organization.create({ data: { name: `${label} (teste papéis)` } });
  }

  async function createUser(organizationId: string | null, roles: Role[], extra: { isSuperAdmin?: boolean } = {}) {
    const email = `papeis-${unique()}@test.com`;
    const user = await rawPrisma.user.create({
      data: { organizationId, email, passwordHash: await bcrypt.hash(PASSWORD, 10), name: email, roles, ...extra },
    });
    return { id: user.id, email };
  }

  async function tokenOf(email: string) {
    const res = await request(server()).post("/auth/login").send({ identifier: email, password: PASSWORD });
    expect(res.status).toBe(200);
    return res.body.accessToken as string;
  }

  function as(token: string) {
    return {
      get: (path: string) => request(server()).get(path).set("Authorization", `Bearer ${token}`),
      post: (path: string, body: object) =>
        request(server()).post(path).set("Authorization", `Bearer ${token}`).send(body),
      patch: (path: string, body: object) =>
        request(server()).patch(path).set("Authorization", `Bearer ${token}`).send(body),
    };
  }

  // Organização com admin fundador + segundo admin + dentista + recepcionista.
  async function clinicWithTeam(label: string) {
    const org = await createOrg(label);
    const founder = await createUser(org.id, ["ADMIN"]);
    const secondAdmin = await createUser(org.id, ["ADMIN"]);
    const dentist = await createUser(org.id, ["DENTIST"]);
    const receptionist = await createUser(org.id, ["RECEPTIONIST"]);
    await rawPrisma.organization.update({ where: { id: org.id }, data: { foundingAdminUserId: founder.id } });
    return { org, founder, secondAdmin, dentist, receptionist };
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.init();
    await rawPrisma.organization.deleteMany({});
    await rawPrisma.user.deleteMany({});
  }, 30000);

  afterAll(async () => {
    await rawPrisma.organization.deleteMany({});
    await rawPrisma.user.deleteMany({});
    await rawPrisma.$disconnect();
    await app.close();
  });

  describe("acesso pela lista de papéis", () => {
    it("usuário [ADMIN, DENTIST] acessa rotas de ADMIN e de DENTIST", async () => {
      const org = await createOrg("Multi");
      const multi = await createUser(org.id, ["ADMIN", "DENTIST"]);
      const token = await tokenOf(multi.email);

      expect((await as(token).get("/users")).status).toBe(200); // users.manage: ADMIN
      expect((await as(token).get("/organization/dentists")).status).toBe(200); // ADMIN, RECEPTIONIST
      expect((await as(token).get(`/reports/financial?${MONTH}`)).status).toBe(200); // DENTIST
      expect((await as(token).get("/attendances?patientId=qualquer")).status).toBe(200); // DENTIST

      const me = await as(token).get("/auth/me");
      expect(me.body.roles).toEqual(["ADMIN", "DENTIST"]);
    });

    it("usuário só DENTIST continua sem acessar rotas de ADMIN", async () => {
      const org = await createOrg("SoDentista");
      const dentist = await createUser(org.id, ["DENTIST"]);
      const token = await tokenOf(dentist.email);

      expect((await as(token).get("/users")).status).toBe(403);
      expect((await as(token).get("/organization/dentists")).status).toBe(403);
      expect((await as(token).get(`/reports/financial?${MONTH}`)).status).toBe(200);
    });

    it("usuário só ADMIN continua sem acessar rotas de DENTIST", async () => {
      const org = await createOrg("SoAdmin");
      const admin = await createUser(org.id, ["ADMIN"]);
      const token = await tokenOf(admin.email);

      expect((await as(token).get("/users")).status).toBe(200);
      expect((await as(token).get(`/reports/financial?${MONTH}`)).status).toBe(403);
    });

    it("Super Admin tem roles vazio e não entra em rota de papel", async () => {
      const superAdmin = await createUser(null, [], { isSuperAdmin: true });
      const token = await tokenOf(superAdmin.email);

      const me = await as(token).get("/auth/me");
      expect(me.body.roles).toEqual([]);
      expect((await as(token).get("/users")).status).toBe(403);
      expect((await as(token).get("/platform/organizations")).status).toBe(200);
    });
  });

  describe("regras de gestão de usuários com a lista", () => {
    it("o único admin ativo não pode se tirar ADMIN nem se desativar", async () => {
      const org = await createOrg("AdminUnico");
      const soleAdmin = await createUser(org.id, ["ADMIN"]);
      await rawPrisma.organization.update({ where: { id: org.id }, data: { foundingAdminUserId: soleAdmin.id } });
      const token = await tokenOf(soleAdmin.email);

      const demote = await as(token).patch(`/users/${soleAdmin.id}`, { roles: ["DENTIST"] });
      expect(demote.status).toBe(400);
      expect(demote.body.message).toBe("A organização precisa de pelo menos um admin ativo");

      const deactivate = await as(token).patch(`/users/${soleAdmin.id}`, { active: false });
      expect(deactivate.status).toBe(400);
      expect(deactivate.body.message).toBe("A organização precisa de pelo menos um admin ativo");
    });

    it("com outro admin ativo, o admin continua sem poder remover o próprio ADMIN", async () => {
      const { founder } = await clinicWithTeam("ProprioAdmin");
      const token = await tokenOf(founder.email);

      const res = await as(token).patch(`/users/${founder.id}`, { roles: ["DENTIST"] });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Você não pode desativar ou rebaixar a própria conta de admin");
    });

    it("o admin pode acrescentar papéis a si mesmo mantendo ADMIN", async () => {
      const { founder } = await clinicWithTeam("AcrescentaPapel");
      const token = await tokenOf(founder.email);

      const res = await as(token).patch(`/users/${founder.id}`, { roles: ["ADMIN", "DENTIST"] });
      expect(res.status).toBe(200);
      expect(res.body.roles).toEqual(["ADMIN", "DENTIST"]);
      // Ganhou DENTIST: passou a ter cor na sidebar da Agenda.
      expect(res.body.colorToken).toBeTruthy();
    });

    it("capitania: admin não-fundador não edita outro admin; o fundador edita", async () => {
      const { founder, secondAdmin } = await clinicWithTeam("Capitania");
      const secondToken = await tokenOf(secondAdmin.email);
      const founderToken = await tokenOf(founder.email);

      expect((await as(secondToken).patch(`/users/${founder.id}`, { roles: ["ADMIN", "DENTIST"] })).status).toBe(403);
      expect((await as(founderToken).patch(`/users/${secondAdmin.id}`, { roles: ["ADMIN", "DENTIST"] })).status).toBe(200);
    });

    it("fundador dá [ADMIN, DENTIST] a um dentista, que passa a acessar rotas de ADMIN", async () => {
      const { founder, dentist } = await clinicWithTeam("Promove");
      const founderToken = await tokenOf(founder.email);
      expect((await as(await tokenOf(dentist.email)).get("/users")).status).toBe(403);

      const res = await as(founderToken).patch(`/users/${dentist.id}`, { roles: ["ADMIN", "DENTIST"] });
      expect(res.status).toBe(200);

      const dentistToken = await tokenOf(dentist.email);
      expect((await as(dentistToken).get("/users")).status).toBe(200);
      expect((await as(dentistToken).get(`/reports/financial?${MONTH}`)).status).toBe(200);
    });

    it("lista de papéis precisa ter pelo menos um papel e sem repetição", async () => {
      const { founder, receptionist } = await clinicWithTeam("Validacao");
      const token = await tokenOf(founder.email);
      const base = { email: `novo-${unique()}@test.com`, password: PASSWORD, name: "Novo" };

      expect((await as(token).post("/users", { ...base, roles: [] })).status).toBe(400);
      expect((await as(token).post("/users", { ...base, roles: ["DENTIST", "DENTIST"] })).status).toBe(400);
      expect((await as(token).post("/users", { ...base, role: "DENTIST" })).status).toBe(400);
      expect((await as(token).patch(`/users/${receptionist.id}`, { roles: [] })).status).toBe(400);
    });

    it("dentista ganha cor: na criação sem cor e ao receber DENTIST depois", async () => {
      const { founder, receptionist } = await clinicWithTeam("Cor");
      const token = await tokenOf(founder.email);

      const created = await as(token).post("/users", {
        email: `dentista-${unique()}@test.com`,
        password: PASSWORD,
        name: "Dentista Novo",
        roles: ["DENTIST"],
      });
      expect(created.status).toBe(201);
      expect(created.body.roles).toEqual(["DENTIST"]);
      expect(created.body.colorToken).toBeTruthy();

      const promoted = await as(token).patch(`/users/${receptionist.id}`, { roles: ["RECEPTIONIST", "DENTIST"] });
      expect(promoted.status).toBe(200);
      expect(promoted.body.colorToken).toBeTruthy();
    });

    it("Minha Clínica lista os papéis de cada membro", async () => {
      const { org, dentist } = await clinicWithTeam("MinhaClinica");
      await rawPrisma.user.update({ where: { id: dentist.id }, data: { roles: ["ADMIN", "DENTIST"] } });
      const token = await tokenOf(dentist.email);

      const res = await as(token).get("/organization");
      expect(res.status).toBe(200);
      const member = res.body.members.find((m: { userId: string }) => m.userId === dentist.id);
      expect(member.roles).toEqual(["ADMIN", "DENTIST"]);
      expect(res.body.id).toBe(org.id);
    });
  });

  it("estatísticas da plataforma: usuário com 2 papéis conta nos dois; total conta pessoas", async () => {
    const org = await createOrg("Estatisticas");
    await createUser(org.id, ["ADMIN", "DENTIST"]);
    const superAdmin = await createUser(null, [], { isSuperAdmin: true });
    const token = await tokenOf(superAdmin.email);

    const res = await as(token).get("/platform/stats/overview");
    expect(res.status).toBe(200);
    const { usersByRole } = res.body;

    const count = (where: object) => rawPrisma.user.count({ where: { active: true, ...where } });
    expect(usersByRole.ADMIN).toBe(await count({ roles: { has: "ADMIN" } }));
    expect(usersByRole.DENTIST).toBe(await count({ roles: { has: "DENTIST" } }));
    expect(usersByRole.RECEPTIONIST).toBe(await count({ roles: { has: "RECEPTIONIST" } }));
    expect(usersByRole.total).toBe(await count({ roles: { isEmpty: false } }));
    // Há pelo menos um usuário com 2 papéis: a soma por papel passa do total.
    expect(usersByRole.ADMIN + usersByRole.DENTIST + usersByRole.RECEPTIONIST).toBeGreaterThan(usersByRole.total);
  });
});
