import { z } from "zod";
import { ROLES, TENANT_TYPES } from "./enums";

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
