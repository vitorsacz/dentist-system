import { z } from "zod";
import { ROLES } from "./enums";

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
  members: z.array(clinicMemberSchema),
});
export type MyClinic = z.infer<typeof myClinicSchema>;
