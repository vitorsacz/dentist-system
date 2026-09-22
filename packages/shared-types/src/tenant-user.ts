import { z } from "zod";
import { ROLES, PALETTE_COLOR_TOKENS } from "./enums";

export const createTenantUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Senha deve ter ao menos 8 caracteres"),
  name: z.string().min(1),
  role: z.enum(ROLES),
  // Opcional — relevante só pra DENTIST (cor na sidebar da Agenda); se
  // omitido, o serviço atribui a próxima cor da paleta por índice.
  colorToken: z.enum(PALETTE_COLOR_TOKENS).optional(),
});
export type CreateTenantUserInput = z.infer<typeof createTenantUserSchema>;

export const updateTenantUserSchema = z.object({
  role: z.enum(ROLES).optional(),
  active: z.boolean().optional(),
  colorToken: z.enum(PALETTE_COLOR_TOKENS).optional(),
});
export type UpdateTenantUserInput = z.infer<typeof updateTenantUserSchema>;

export const managedTenantUserSchema = z.object({
  userId: z.string(),
  email: z.string().email(),
  name: z.string(),
  role: z.enum(ROLES),
  active: z.boolean(),
  colorToken: z.enum(PALETTE_COLOR_TOKENS).nullable(),
  createdAt: z.string(),
});
export type ManagedTenantUser = z.infer<typeof managedTenantUserSchema>;
