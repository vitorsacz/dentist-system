import { z } from "zod";
import { ROLES } from "./enums";

export const createTenantUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Senha deve ter ao menos 8 caracteres"),
  name: z.string().min(1),
  role: z.enum(ROLES),
});
export type CreateTenantUserInput = z.infer<typeof createTenantUserSchema>;

export const updateTenantUserSchema = z.object({
  role: z.enum(ROLES).optional(),
  active: z.boolean().optional(),
});
export type UpdateTenantUserInput = z.infer<typeof updateTenantUserSchema>;

export const managedTenantUserSchema = z.object({
  userId: z.string(),
  email: z.string().email(),
  name: z.string(),
  role: z.enum(ROLES),
  active: z.boolean(),
  createdAt: z.string(),
});
export type ManagedTenantUser = z.infer<typeof managedTenantUserSchema>;
