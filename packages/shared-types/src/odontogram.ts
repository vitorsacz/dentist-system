import { z } from "zod";
import { TOOTH_RECORD_STATUSES } from "./enums";

const FDI_TOOTH_NUMBERS = [
  11, 12, 13, 14, 15, 16, 17, 18, 21, 22, 23, 24, 25, 26, 27, 28, 31, 32, 33, 34, 35, 36,
  37, 38, 41, 42, 43, 44, 45, 46, 47, 48,
] as const;

export const upsertToothRecordSchema = z.object({
  toothNumber: z.number().int().refine((n) => (FDI_TOOTH_NUMBERS as readonly number[]).includes(n), {
    message: "Número de dente inválido (use a notação FDI, ex.: 11-48)",
  }),
  procedure: z.string().min(1),
  status: z.enum(TOOTH_RECORD_STATUSES),
  notes: z.string().optional(),
});
export type UpsertToothRecordInput = z.infer<typeof upsertToothRecordSchema>;

export const updateToothRecordStatusSchema = z.object({
  status: z.enum(TOOTH_RECORD_STATUSES),
});
export type UpdateToothRecordStatusInput = z.infer<typeof updateToothRecordStatusSchema>;
