import { z } from "zod";
import { optionalCoercedDate } from "./utils";

export const createMaterialSchema = z.object({
  name: z.string().min(1),
  unit: z.string().min(1),
  minimumStock: z.coerce.number().min(0),
});
export type CreateMaterialInput = z.infer<typeof createMaterialSchema>;

export const updateMaterialSchema = createMaterialSchema.partial();
export type UpdateMaterialInput = z.infer<typeof updateMaterialSchema>;

export const createMaterialBatchSchema = z.object({
  quantity: z.coerce.number().positive(),
  expiryDate: optionalCoercedDate,
});
export type CreateMaterialBatchInput = z.infer<typeof createMaterialBatchSchema>;
