import { z } from "zod";

export const createProcedureSchema = z.object({
  name: z.string().min(1),
  defaultValue: z.coerce.number().positive(),
  active: z.boolean().default(true),
});
export type CreateProcedureInput = z.infer<typeof createProcedureSchema>;

export const updateProcedureSchema = createProcedureSchema.partial();
export type UpdateProcedureInput = z.infer<typeof updateProcedureSchema>;
