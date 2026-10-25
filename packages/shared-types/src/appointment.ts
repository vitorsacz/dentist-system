import { z } from "zod";
import { APPOINTMENT_STATUSES } from "./enums";

export const MAX_APPOINTMENT_DURATION_MS = 8 * 60 * 60 * 1000;

const dateWithOffsetSchema = z
  .string()
  .datetime({ offset: true })
  .transform((s) => new Date(s));

export const createAppointmentSchema = z
  .object({
    patientId: z.string().min(1),
    clinicId: z.string().min(1),
    dentistUserId: z.string().min(1),
    startsAt: dateWithOffsetSchema,
    endsAt: dateWithOffsetSchema,
    notes: z.string().optional(),
    allowOverlap: z.boolean().optional(),
  })
  .superRefine((d, ctx) => {
    if (d.endsAt <= d.startsAt) {
      ctx.addIssue({ code: "custom", path: ["endsAt"], message: "endsAt deve ser posterior a startsAt" });
    }
    if (d.endsAt.getTime() - d.startsAt.getTime() > MAX_APPOINTMENT_DURATION_MS) {
      ctx.addIssue({ code: "custom", path: ["endsAt"], message: "Duração máxima de 8 horas" });
    }
  });
export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;

export const updateAppointmentSchema = z.object({
  clinicId: z.string().min(1).optional(),
  dentistUserId: z.string().min(1).optional(),
  startsAt: dateWithOffsetSchema.optional(),
  endsAt: dateWithOffsetSchema.optional(),
  status: z.enum(APPOINTMENT_STATUSES).optional(),
  notes: z.string().optional(),
  allowOverlap: z.boolean().optional(),
});
export type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>;

export const cancelAppointmentSchema = z.object({});
export type CancelAppointmentInput = z.infer<typeof cancelAppointmentSchema>;

export const listAppointmentsQuerySchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
  clinicId: z.string().optional(),
  dentistUserId: z.string().optional(),
});
export type ListAppointmentsQuery = z.infer<typeof listAppointmentsQuerySchema>;

export interface ConflictInfo {
  id: string;
  startsAt: string;
  endsAt: string;
  patientName: string | null;
}
