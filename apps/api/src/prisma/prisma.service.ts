import { PrismaClient } from "@prisma/client";
import { createTenantScopedClient } from "./tenant.extension";

export const PRISMA_SERVICE = Symbol("PRISMA_SERVICE");

export const prismaBaseClient = new PrismaClient();
export const prismaTenantScopedClient = createTenantScopedClient(prismaBaseClient);

// Type alias, não classe: `$extends()` retorna um client novo (proxy), não dá
// pra subclassificar PrismaClient e manter a extension. Toda injeção usa
// `@Inject(PRISMA_SERVICE)` com este tipo, ver prisma.module.ts.
export type PrismaService = typeof prismaTenantScopedClient;

// Tipo do `tx` recebido pelo callback de `$transaction` no client já
// estendido — usado em qualquer service que abre transação interativa (ver
// attendances.service.ts) em vez de `Prisma.TransactionClient` (que é o tipo
// do client SEM a extension).
export type TenantScopedTransactionClient = Parameters<
  Parameters<PrismaService["$transaction"]>[0]
>[0];
