import { z } from "zod";
import { ROLES } from "./enums";

export const lookupAccountsSchema = z.object({
  identifier: z.string().min(1),
});
export type LookupAccountsInput = z.infer<typeof lookupAccountsSchema>;

export const accountOptionSchema = z.object({
  organizationId: z.string(),
  organizationName: z.string(),
});
export type AccountOption = z.infer<typeof accountOptionSchema>;

export const lookupAccountsResultSchema = z.object({
  requiresOrganizationSelection: z.boolean(),
  accounts: z.array(accountOptionSchema),
});
export type LookupAccountsResult = z.infer<typeof lookupAccountsResultSchema>;

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
