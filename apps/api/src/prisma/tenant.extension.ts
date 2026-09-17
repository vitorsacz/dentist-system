import { NotFoundException } from "@nestjs/common";
import { Prisma, PrismaClient } from "@prisma/client";
import { getTenantContext } from "./tenant-context";

// User, Organization e Membership ficam de fora: são o próprio mecanismo de
// resolução de tenant, não dado de negócio escopado por organização. Todo
// acesso a eles precisa filtrar organizationId manualmente onde fizer sentido
// (ver users.service.ts).
export const TENANT_SCOPED_MODELS = [
  "Clinic",
  "Patient",
  "Anamnesis",
  "ClinicalRecord",
  "ToothRecord",
  "ProcedureCatalog",
  "Budget",
  "BudgetItem",
  "Appointment",
  "Attendance",
  "Material",
  "MaterialBatch",
  "MaterialUsage",
  "Recall",
] as const;

const READ_AND_BULK_OPS = new Set([
  "findMany",
  "findFirst",
  "findFirstOrThrow",
  "count",
  "aggregate",
  "groupBy",
  "updateMany",
  "deleteMany",
]);

const SINGLE_MUTATION_OPS = new Set(["update", "delete", "upsert"]);

/**
 * Envolve um PrismaClient com isolamento de tenant automático. Toda operação
 * nos models de TENANT_SCOPED_MODELS é filtrada/carimbada pelo organizationId
 * do AsyncLocalStorage corrente. Ver
 * apps/dentist-system (vault Obsidian) "Plano de Implementação SaaS" pro
 * porquê dessa camada em vez de RLS do Postgres.
 */
export function createTenantScopedClient<T extends PrismaClient>(base: T) {
  return base.$extends({
    name: "tenant-isolation",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!model || !(TENANT_SCOPED_MODELS as readonly string[]).includes(model)) {
            return query(args);
          }
          const { organizationId } = getTenantContext();
          const typedArgs = args as Record<string, unknown>;

          if (READ_AND_BULK_OPS.has(operation)) {
            typedArgs.where = { ...(typedArgs.where as Record<string, unknown> | undefined), organizationId };
            return query(typedArgs);
          }

          if (operation === "findUnique" || operation === "findUniqueOrThrow") {
            const result = (await query(args)) as { organizationId?: string } | null;
            if (result && result.organizationId !== organizationId) {
              if (operation === "findUniqueOrThrow") {
                throw new NotFoundException("Registro não encontrado");
              }
              return null;
            }
            return result;
          }

          if (operation === "create") {
            typedArgs.data = { ...(typedArgs.data as Record<string, unknown>), organizationId };
            return query(typedArgs);
          }

          if (operation === "createMany") {
            const data = typedArgs.data;
            typedArgs.data = Array.isArray(data)
              ? data.map((row: Record<string, unknown>) => ({ ...row, organizationId }))
              : data;
            return query(typedArgs);
          }

          if (SINGLE_MUTATION_OPS.has(operation)) {
            // "Extended whereUnique filtering" (GA desde o Prisma 4.5): dá pra
            // combinar um campo não-único (organizationId) com a chave única
            // no where de update/delete/upsert. Vira um único
            // UPDATE/DELETE ... WHERE id = $1 AND organizationId = $2 atômico
            // — sem pre-check separado, sem janela de corrida.
            typedArgs.where = { ...(typedArgs.where as Record<string, unknown>), organizationId };
            if (operation === "upsert" && typedArgs.create) {
              typedArgs.create = { ...(typedArgs.create as Record<string, unknown>), organizationId };
            }
            try {
              return await query(typedArgs);
            } catch (error) {
              if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
                throw new NotFoundException("Registro não encontrado");
              }
              throw error;
            }
          }

          return query(args);
        },
      },
    },
  });
}

export type TenantScopedClient = ReturnType<typeof createTenantScopedClient>;
