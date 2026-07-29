import { z } from "zod";
import { BUDGET_STATUSES } from "./enums";

export const budgetItemInputSchema = z.object({
  procedureId: z.string().min(1),
  toothNumber: z.number().int().optional(),
  value: z.coerce.number().positive(),
  notes: z.string().optional(),
});
export type BudgetItemInput = z.infer<typeof budgetItemInputSchema>;

export const createBudgetSchema = z.object({
  patientId: z.string().min(1),
  items: z.array(budgetItemInputSchema).min(1),
});
export type CreateBudgetInput = z.infer<typeof createBudgetSchema>;

export const updateBudgetStatusSchema = z.object({
  status: z.enum(BUDGET_STATUSES),
});
export type UpdateBudgetStatusInput = z.infer<typeof updateBudgetStatusSchema>;
