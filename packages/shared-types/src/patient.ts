import { z } from "zod";
import { optionalCoercedDate } from "./utils";

export const createPatientSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
  birthDate: optionalCoercedDate,
  address: z.string().optional(),
});
export type CreatePatientInput = z.infer<typeof createPatientSchema>;

export const updatePatientSchema = createPatientSchema.partial();
export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;

export const upsertAnamnesisSchema = z.object({
  allergies: z.string().optional(),
  medications: z.string().optional(),
  healthConditions: z.string().optional(),
  dentalHistory: z.string().optional(),
  chiefComplaint: z.string().optional(),
});
export type UpsertAnamnesisInput = z.infer<typeof upsertAnamnesisSchema>;

export const createClinicalRecordSchema = z.object({
  date: z.coerce.date(),
  procedureNote: z.string().min(1),
  observations: z.string().optional(),
});
export type CreateClinicalRecordInput = z.infer<typeof createClinicalRecordSchema>;
