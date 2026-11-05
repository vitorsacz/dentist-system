import { z } from "zod";
import { ROLES, TENANT_TYPES, PALETTE_COLOR_TOKENS } from "./enums";

export const clinicMemberSchema = z.object({
  userId: z.string(),
  name: z.string(),
  roles: z.array(z.enum(ROLES)),
  active: z.boolean(),
});
export type ClinicMember = z.infer<typeof clinicMemberSchema>;

export const myClinicSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(TENANT_TYPES),
  members: z.array(clinicMemberSchema),
});
export type MyClinic = z.infer<typeof myClinicSchema>;

// Roster pra sidebar de dentistas da Agenda (admin/recepcionista) — não é o
// mesmo endpoint de myClinicSchema (esse é permissivo pra qualquer papel,
// inclusive DENTIST; este aqui é ADMIN/RECEPTIONIST only, ver
// OrganizationController). Só dentistas ativos.
export const organizationDentistSchema = z.object({
  id: z.string(),
  name: z.string(),
  nickname: z.string().nullable(),
  colorToken: z.enum(PALETTE_COLOR_TOKENS).nullable(),
  active: z.boolean(),
});
export type OrganizationDentist = z.infer<typeof organizationDentistSchema>;

// Decoded base64 of 300 KB = 307200 bytes → ceil(307200/3)*4 = 409600 base64 chars + ~23 prefix
const LOGO_MAX_BASE64_CHARS = 409623;
export const updateOrganizationProfileSchema = z.object({
  phone: z.string().max(30).optional(),
  email: z.string().email().optional(),
  address: z.string().max(255).optional(),
  logoDataUrl: z
    .string()
    .regex(/^data:image\/(png|jpeg);base64,/, "Logo deve ser PNG ou JPEG em base64")
    .max(LOGO_MAX_BASE64_CHARS, "Logo deve ter no máximo 300 KB")
    .nullable()
    .optional(),
});
export type UpdateOrganizationProfileInput = z.infer<typeof updateOrganizationProfileSchema>;
