import { Prisma } from "@prisma/client";
import { TENANT_SCOPED_MODELS } from "../src/prisma/tenant.extension";

// Rede de segurança pra lista TENANT_SCOPED_MODELS, que é mantida à mão: um
// model novo com organizationId que ficar fora dela não recebe isolamento de
// tenant nenhum (a extension simplesmente deixa a query passar), e nada mais
// avisa. Lê os models do DMMF do client gerado — mesma fonte da verdade que o
// Prisma usa em runtime — em vez de parsear o schema.prisma à mão.
//
// Não precisa de banco: roda na suíte e2e só pra entrar no mesmo `pnpm test`
// do CI.

// Models que têm organizationId mas ficam FORA da extension de propósito.
// Cada exceção precisa de um motivo — incluir um model aqui significa que
// todo acesso a ele filtra organizationId manualmente no service.
const INTENTIONALLY_UNSCOPED_MODELS: Record<string, string> = {
  // User é o próprio mecanismo de resolução de tenant: o login busca o User
  // por e-mail/nickname antes de existir organização no contexto, e o Super
  // Admin tem organizationId null. users.service.ts, auth.service.ts e
  // organization.service.ts filtram organizationId manualmente.
  User: "resolução de tenant no login + Super Admin sem organização",
};

const TENANT_FIELD = "organizationId";

const schemaModels = Prisma.dmmf.datamodel.models;
const schemaModelNames = new Set(schemaModels.map((model) => model.name));
const modelsWithTenantField = schemaModels
  .filter((model) => model.fields.some((field) => field.name === TENANT_FIELD))
  .map((model) => model.name);
const scopedModels = new Set<string>(TENANT_SCOPED_MODELS);

describe("Cobertura de TENANT_SCOPED_MODELS", () => {
  it("encontra models com organizationId no schema (sanidade do DMMF)", () => {
    expect(modelsWithTenantField.length).toBeGreaterThan(0);
  });

  it("todo model com organizationId está em TENANT_SCOPED_MODELS ou nas exceções", () => {
    const missing = modelsWithTenantField.filter(
      (name) => !scopedModels.has(name) && !(name in INTENTIONALLY_UNSCOPED_MODELS),
    );

    if (missing.length > 0) {
      throw new Error(
        `Model(s) com ${TENANT_FIELD} sem isolamento de tenant: ${missing.join(", ")}.\n` +
          `Sem isso, qualquer query nesses models enxerga dados de TODAS as organizações.\n` +
          `O que fazer: adicione o(s) nome(s) em TENANT_SCOPED_MODELS ` +
          `(apps/api/src/prisma/tenant.extension.ts). Se o model precisar mesmo ficar ` +
          `fora da extension, adicione-o em INTENTIONALLY_UNSCOPED_MODELS neste teste, ` +
          `com o motivo, e filtre ${TENANT_FIELD} manualmente em todo service que o acessa.`,
      );
    }
  });

  it("TENANT_SCOPED_MODELS só contém models que existem no schema e têm organizationId", () => {
    const unknown = TENANT_SCOPED_MODELS.filter((name) => !schemaModelNames.has(name));
    const withoutTenantField = TENANT_SCOPED_MODELS.filter(
      (name) => schemaModelNames.has(name) && !modelsWithTenantField.includes(name),
    );

    const problems: string[] = [];
    if (unknown.length > 0) {
      problems.push(
        `Não existem no schema: ${unknown.join(", ")} — model renomeado ou removido? ` +
          `Corrija o nome ou remova-o de TENANT_SCOPED_MODELS.`,
      );
    }
    if (withoutTenantField.length > 0) {
      problems.push(
        `Não têm campo ${TENANT_FIELD}: ${withoutTenantField.join(", ")} — a extension ` +
          `injetaria um filtro num campo inexistente. Adicione ${TENANT_FIELD} ao model ` +
          `ou remova-o de TENANT_SCOPED_MODELS.`,
      );
    }
    if (problems.length > 0) {
      throw new Error(
        `TENANT_SCOPED_MODELS (apps/api/src/prisma/tenant.extension.ts) desatualizada:\n` +
          problems.join("\n"),
      );
    }
  });

  it("exceções intencionais existem no schema e não estão também em TENANT_SCOPED_MODELS", () => {
    for (const name of Object.keys(INTENTIONALLY_UNSCOPED_MODELS)) {
      if (!modelsWithTenantField.includes(name)) {
        throw new Error(
          `Exceção "${name}" em INTENTIONALLY_UNSCOPED_MODELS não é um model com ${TENANT_FIELD} ` +
            `no schema — remova-a deste teste.`,
        );
      }
      if (scopedModels.has(name)) {
        throw new Error(
          `"${name}" está em TENANT_SCOPED_MODELS e em INTENTIONALLY_UNSCOPED_MODELS ao mesmo ` +
            `tempo — escolha um dos dois.`,
        );
      }
    }
  });
});
