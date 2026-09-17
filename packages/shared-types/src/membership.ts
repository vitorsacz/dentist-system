import { z } from "zod";
import { ROLES } from "./enums";

export const createMembershipUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Senha deve ter ao menos 8 caracteres"),
  name: z.string().min(1),
  role: z.enum(ROLES),
});
export type CreateMembershipUserInput = z.infer<typeof createMembershipUserSchema>;

export const updateMembershipSchema = z.object({
  role: z.enum(ROLES).optional(),
  active: z.boolean().optional(),
});
export type UpdateMembershipInput = z.infer<typeof updateMembershipSchema>;

export const managedMembershipSchema = z.object({
  membershipId: z.string(),
  userId: z.string(),
  email: z.string().email(),
  name: z.string(),
  role: z.enum(ROLES),
  active: z.boolean(),
  createdAt: z.string(),
});
export type ManagedMembership = z.infer<typeof managedMembershipSchema>;
