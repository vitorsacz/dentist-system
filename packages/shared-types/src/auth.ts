import { z } from "zod";
import { ROLES } from "./enums";

export const accountOptionSchema = z.object({
  organizationId: z.string(),
  organizationName: z.string(),
});
export type AccountOption = z.infer<typeof accountOptionSchema>;

// Identidade é isolada por organização: o mesmo e-mail pode ter conta em
// várias, com senhas diferentes. `organizationId` só é enviado depois que o
// próprio login respondeu `requiresOrganizationSelection` (a senha é validada
// de novo nesse reenvio).
export const loginSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1),
  organizationId: z.string().optional(),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const authTokensSchema = z.object({
  accessToken: z.string(),
});
export type AuthTokens = z.infer<typeof authTokensSchema>;

// Resposta do login quando a senha confere em mais de uma organização e o
// request não trouxe `organizationId`. Lista só as organizações em que a
// senha conferiu — nunca as demais contas do mesmo e-mail.
export const organizationSelectionSchema = z.object({
  requiresOrganizationSelection: z.literal(true),
  accounts: z.array(accountOptionSchema),
});
export type OrganizationSelection = z.infer<typeof organizationSelectionSchema>;

export const loginResultSchema = z.union([authTokensSchema, organizationSelectionSchema]);
export type LoginResult = z.infer<typeof loginResultSchema>;

export const currentUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  organizationId: z.string().nullable(),
  role: z.enum(ROLES).nullable(),
  isSuperAdmin: z.boolean(),
});
export type CurrentUser = z.infer<typeof currentUserSchema>;

export const resetPasswordSchema = z.object({
  password: z.string().min(8, "Senha deve ter ao menos 8 caracteres"),
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
