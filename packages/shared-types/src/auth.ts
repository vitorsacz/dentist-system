import { z } from "zod";
import { ROLES } from "./enums";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
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
  role: z.enum(ROLES),
  organizationId: z.string(),
  membershipId: z.string(),
});
export type CurrentUser = z.infer<typeof currentUserSchema>;

export const resetPasswordSchema = z.object({
  password: z.string().min(8, "Senha deve ter ao menos 8 caracteres"),
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
