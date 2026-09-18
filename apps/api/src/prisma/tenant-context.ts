import { AsyncLocalStorage } from "node:async_hooks";

export interface TenantContext {
  organizationId: string;
}

export const tenantContextStorage = new AsyncLocalStorage<TenantContext>();

export function getTenantContext(): TenantContext {
  const ctx = tenantContextStorage.getStore();
  if (!ctx) {
    throw new Error("Tenant context indisponível fora de uma requisição autenticada");
  }
  return ctx;
}

export function runWithTenantContext<T>(ctx: TenantContext, fn: () => T): T {
  return tenantContextStorage.run(ctx, fn);
}
