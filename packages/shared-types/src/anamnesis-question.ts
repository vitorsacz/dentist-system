import { z } from "zod";

export const ANAMNESIS_QUESTION_KINDS = ["YES_NO", "TEXT"] as const;
export type AnamnesisQuestionKind = (typeof ANAMNESIS_QUESTION_KINDS)[number];

export const createAnamnesisQuestionSchema = z.object({
  key: z.string().min(1).max(64).regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, "key deve ser camelCase sem espaços"),
  label: z.string().min(1).max(255),
  kind: z.enum(ANAMNESIS_QUESTION_KINDS).default("YES_NO"),
  detailRequiredWhenYes: z.boolean().default(false),
  alertWhenYes: z.boolean().default(false),
  sensitive: z.boolean().default(false),
  active: z.boolean().default(true),
});
export type CreateAnamnesisQuestionInput = z.infer<typeof createAnamnesisQuestionSchema>;

export const updateAnamnesisQuestionSchema = z.object({
  label: z.string().min(1).max(255).optional(),
  kind: z.enum(ANAMNESIS_QUESTION_KINDS).optional(),
  detailRequiredWhenYes: z.boolean().optional(),
  alertWhenYes: z.boolean().optional(),
  sensitive: z.boolean().optional(),
});
export type UpdateAnamnesisQuestionInput = z.infer<typeof updateAnamnesisQuestionSchema>;

export const reorderAnamnesisQuestionsSchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
});
export type ReorderAnamnesisQuestionsInput = z.infer<typeof reorderAnamnesisQuestionsSchema>;
