import { z } from "zod";
import { RECALL_STATUSES } from "./enums";

export const createRecallSchema = z.object({
  patientId: z.string().min(1),
  dueDate: z.coerce.date(),
  reason: z.string().optional(),
});
export type CreateRecallInput = z.infer<typeof createRecallSchema>;

export const updateRecallStatusSchema = z.object({
  status: z.enum(RECALL_STATUSES),
});
export type UpdateRecallStatusInput = z.infer<typeof updateRecallStatusSchema>;
