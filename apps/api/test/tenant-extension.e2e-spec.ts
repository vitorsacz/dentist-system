import { PrismaClient } from "@prisma/client";
import { createTenantScopedClient } from "../src/prisma/tenant.extension";
import { runWithTenantContext } from "../src/prisma/tenant-context";
import { TEST_DATABASE_URL } from "./test-db";

const base = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } });
const prisma = createTenantScopedClient(base);

// IMPORTANTE: o callback passado pra runWithTenantContext precisa dar `await`
// na query do Prisma *dentro* de si mesmo. `prisma.model.create(...)` retorna
// uma PrismaPromise preguiçosa — só dispara a query (e o hook $allOperations
// da extension) quando algo chama `.then()`/await nela. Se o callback só faz
// `return prisma.model.create(...)` sem await, o `.then()` real acontece só
// depois que `AsyncLocalStorage.run()` já retornou pro chamador externo, fora
// do contexto — e a extension explode com "tenant context indisponível".
// Sempre `async () => await prisma...` aqui nos testes; nos services reais do
// NestJS isso já é natural, porque todo método usa `await this.prisma...`.

describe("Prisma tenant isolation extension", () => {
  let orgA: { id: string };
  let orgB: { id: string };
  let userA: { id: string };

  beforeAll(async () => {
    await base.organization.deleteMany({});
    await base.user.deleteMany({});
    orgA = await base.organization.create({ data: { name: "Org A (teste)" } });
    orgB = await base.organization.create({ data: { name: "Org B (teste)" } });
    userA = await base.user.create({
      data: { email: `user-a-${Date.now()}@test.com`, passwordHash: "x", name: "Usuário A" },
    });
  });

  afterAll(async () => {
    await base.organization.deleteMany({});
    await base.user.deleteMany({});
    await base.$disconnect();
  });

  it("create() carimba organizationId automaticamente a partir do contexto", async () => {
    const patient = await runWithTenantContext({ organizationId: orgA.id }, async () =>
      prisma.patient.create({
        data: { name: "Paciente A", phone: "11999999999", createdByUserId: userA.id, organizationId: orgA.id },
      }),
    );
    expect(patient.organizationId).toBe(orgA.id);
  });

  it("findMany() nunca retorna linha de outra organização", async () => {
    await runWithTenantContext({ organizationId: orgB.id }, async () =>
      prisma.patient.create({
        data: { name: "Paciente B", phone: "11888888888", createdByUserId: userA.id, organizationId: orgB.id },
      }),
    );
    const seenByA = await runWithTenantContext({ organizationId: orgA.id }, async () =>
      prisma.patient.findMany({}),
    );
    expect(seenByA.every((p) => p.organizationId === orgA.id)).toBe(true);
    expect(seenByA.some((p) => p.name === "Paciente B")).toBe(false);
  });

  it("findUnique() por id de outra organização retorna null, não vaza dado", async () => {
    const patientB = await runWithTenantContext({ organizationId: orgB.id }, async () =>
      prisma.patient.create({
        data: { name: "Paciente B2", phone: "11888888887", createdByUserId: userA.id, organizationId: orgB.id },
      }),
    );
    const result = await runWithTenantContext({ organizationId: orgA.id }, async () =>
      prisma.patient.findUnique({ where: { id: patientB.id } }),
    );
    expect(result).toBeNull();
  });

  it("update() por id de outra organização lança NotFoundException e não sobrescreve", async () => {
    const patientB = await runWithTenantContext({ organizationId: orgB.id }, async () =>
      prisma.patient.create({
        data: { name: "Paciente B3", phone: "11888888886", createdByUserId: userA.id, organizationId: orgB.id },
      }),
    );

    await expect(
      runWithTenantContext({ organizationId: orgA.id }, async () =>
        prisma.patient.update({ where: { id: patientB.id }, data: { name: "Hackeado" } }),
      ),
    ).rejects.toThrow("Registro não encontrado");

    const stillIntact = await base.patient.findUnique({ where: { id: patientB.id } });
    expect(stillIntact?.name).toBe("Paciente B3");
  });

  it("a extensão se propaga para o `tx` dentro de $transaction (risco crítico do plano, validado empiricamente)", async () => {
    const patientB = await runWithTenantContext({ organizationId: orgB.id }, async () =>
      prisma.patient.create({
        data: { name: "Paciente B4", phone: "11888888885", createdByUserId: userA.id, organizationId: orgB.id },
      }),
    );

    await runWithTenantContext({ organizationId: orgA.id }, async () =>
      prisma.$transaction(async (tx) => {
        const foundInTx = await tx.patient.findMany({});
        expect(foundInTx.every((p) => p.organizationId === orgA.id)).toBe(true);
        expect(foundInTx.some((p) => p.id === patientB.id)).toBe(false);

        await expect(
          tx.patient.update({ where: { id: patientB.id }, data: { name: "x" } }),
        ).rejects.toThrow("Registro não encontrado");
      }),
    );
  });
});
