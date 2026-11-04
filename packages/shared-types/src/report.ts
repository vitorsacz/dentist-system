import { z } from "zod";

export const financialReportQuerySchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
  clinicId: z.string().optional(),
});
export type FinancialReportQuery = z.infer<typeof financialReportQuerySchema>;

export const financialReportClinicRowSchema = z.object({
  clinicId: z.string(),
  clinicName: z.string(),
  // F3: populado em respostas de ADMIN; ausente para DENTIST.
  dentistUserId: z.string().optional(),
  dentistName: z.string().optional(),
  grossRevenue: z.number(),
  dentistRepasse: z.number(),
  materialCost: z.number(),
  rentCost: z.number(),
  netResult: z.number(),
});
export type FinancialReportClinicRow = z.infer<typeof financialReportClinicRowSchema>;

export const financialReportSchema = z.object({
  from: z.string(),
  to: z.string(),
  clinics: z.array(financialReportClinicRowSchema),
  totals: z.object({
    grossRevenue: z.number(),
    dentistRepasse: z.number(),
    materialCost: z.number(),
    rentCost: z.number(),
    netResult: z.number(),
  }),
  // Nomes dos consultórios sem termos definidos (só relevante pra FREELANCER).
  clinicsWithoutTerms: z.array(z.string()),
});
export type FinancialReport = z.infer<typeof financialReportSchema>;
