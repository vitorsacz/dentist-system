import { z } from "zod";

export const materialUsageInputSchema = z.object({
  materialId: z.string().min(1),
  quantity: z.coerce.number().positive(),
});
export type MaterialUsageInput = z.infer<typeof materialUsageInputSchema>;

export const createAttendanceSchema = z.object({
  patientId: z.string().min(1),
  appointmentId: z.string().optional(),
  clinicId: z.string().min(1),
  procedureId: z.string().min(1),
  date: z.coerce.date(),
  grossValue: z.coerce.number().positive(),
  repassePercentage: z.coerce.number().min(0).max(100),
  materialCost: z.coerce.number().min(0).default(0),
  materialUsages: z.array(materialUsageInputSchema).default([]),
});
export type CreateAttendanceInput = z.infer<typeof createAttendanceSchema>;
