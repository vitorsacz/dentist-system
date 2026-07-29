import { z } from "zod";
import { APPOINTMENT_STATUSES } from "./enums";

export const createAppointmentSchema = z.object({
  patientId: z.string().min(1),
  clinicId: z.string().min(1),
  startsAt: z.coerce.date(),
  notes: z.string().optional(),
});
export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;

export const updateAppointmentSchema = z.object({
  clinicId: z.string().min(1).optional(),
  startsAt: z.coerce.date().optional(),
  status: z.enum(APPOINTMENT_STATUSES).optional(),
  notes: z.string().optional(),
});
export type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>;

export const listAppointmentsQuerySchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
  clinicId: z.string().optional(),
});
export type ListAppointmentsQuery = z.infer<typeof listAppointmentsQuerySchema>;
