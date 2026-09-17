import { z } from "zod";
import { TENANT_TYPES, ORGANIZATION_STATUSES } from "./enums";

export const createOrganizationSchema = z.object({
  name: z.string().min(1),
  foundingAdminEmail: z.string().email(),
  foundingAdminName: z.string().min(1),
  foundingAdminPassword: z.string().min(8, "Senha deve ter ao menos 8 caracteres"),
});
export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;

export const platformOrganizationSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(TENANT_TYPES),
  status: z.enum(ORGANIZATION_STATUSES),
  foundingAdminUserId: z.string().nullable(),
  createdAt: z.string(),
});
export type PlatformOrganization = z.infer<typeof platformOrganizationSchema>;

export const transferFoundingAdminSchema = z.object({
  userId: z.string(),
});
export type TransferFoundingAdminInput = z.infer<typeof transferFoundingAdminSchema>;
