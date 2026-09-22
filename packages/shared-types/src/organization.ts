import { z } from "zod";
import { ROLES, TENANT_TYPES, PALETTE_COLOR_TOKENS } from "./enums";

export const clinicMemberSchema = z.object({
  userId: z.string(),
  name: z.string(),
  role: z.enum(ROLES),
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
  userId: z.string(),
  name: z.string(),
  colorToken: z.enum(PALETTE_COLOR_TOKENS).nullable(),
});
export type OrganizationDentist = z.infer<typeof organizationDentistSchema>;
