import { z } from "zod";
import { LOCATION_RELATIONSHIP_TYPES, RENT_PERIODICITIES } from "./enums";

const ownerLabelField = { ownerLabel: z.string().min(1).optional() };

// Discriminada por relationshipType: cada ramo só aceita os campos daquele
// tipo — evita salvar, por exemplo, commissionPercentage preenchido junto
// com um registro RENTED_FIXED.
export const upsertClinicFinancialTermsSchema = z.discriminatedUnion("relationshipType", [
  z.object({
    relationshipType: z.literal("RENTED_FIXED"),
    rentValue: z.coerce.number().positive(),
    rentPeriodicity: z.enum(RENT_PERIODICITIES),
    ...ownerLabelField,
  }),
  z.object({
    relationshipType: z.literal("COMMISSION"),
    commissionPercentage: z.coerce.number().min(0).max(100),
    ...ownerLabelField,
  }),
  z.object({
    relationshipType: z.literal("PER_SERVICE"),
    defaultServiceRate: z.coerce.number().positive(),
    ...ownerLabelField,
  }),
]);
export type UpsertClinicFinancialTermsInput = z.infer<typeof upsertClinicFinancialTermsSchema>;

export const clinicFinancialTermsSchema = z.object({
  id: z.string(),
  clinicId: z.string(),
  relationshipType: z.enum(LOCATION_RELATIONSHIP_TYPES),
  rentValue: z.number().nullable(),
  rentPeriodicity: z.enum(RENT_PERIODICITIES).nullable(),
  commissionPercentage: z.number().nullable(),
  defaultServiceRate: z.number().nullable(),
  ownerLabel: z.string().nullable(),
  updatedAt: z.string(),
});
export type ClinicFinancialTerms = z.infer<typeof clinicFinancialTermsSchema>;
