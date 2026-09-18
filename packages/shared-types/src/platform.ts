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

export const platformOrganizationDetailSchema = platformOrganizationSchema.extend({
  foundingAdmin: z.object({ name: z.string(), email: z.string() }).nullable(),
});
export type PlatformOrganizationDetail = z.infer<typeof platformOrganizationDetailSchema>;

export const organizationsByStatusSchema = z.object({
  ACTIVE: z.number(),
  SUSPENDED: z.number(),
  DELETED: z.number(),
  total: z.number(),
});
export type OrganizationsByStatus = z.infer<typeof organizationsByStatusSchema>;

export const usersByRoleSchema = z.object({
  ADMIN: z.number(),
  DENTIST: z.number(),
  RECEPTIONIST: z.number(),
  total: z.number(),
});
export type UsersByRole = z.infer<typeof usersByRoleSchema>;

export const monthlyCountSchema = z.object({
  month: z.string(),
  count: z.number(),
});
export type MonthlyCount = z.infer<typeof monthlyCountSchema>;

export const platformOrganizationRankingRowSchema = z.object({
  organizationId: z.string(),
  name: z.string(),
  status: z.enum(ORGANIZATION_STATUSES),
  attendanceCount: z.number(),
});
export type PlatformOrganizationRankingRow = z.infer<typeof platformOrganizationRankingRowSchema>;

export const platformOverviewStatsSchema = z.object({
  organizationsByStatus: organizationsByStatusSchema,
  usersByRole: usersByRoleSchema,
  totalDentistsRegistered: z.number(),
  totalDentistsActive: z.number(),
  newTenantsByMonth: z.array(monthlyCountSchema),
  attendancesThisMonth: z.number(),
  topOrganizationsByAttendance: z.array(platformOrganizationRankingRowSchema),
});
export type PlatformOverviewStats = z.infer<typeof platformOverviewStatsSchema>;
