import { z } from "zod";
import { optionalCoercedDate, emptyStringToUndefined } from "./utils";

export const SexEnum = z.enum(["F", "M"]);
export type Sex = z.infer<typeof SexEnum>;

export const MaritalStatusEnum = z.enum([
  "SOLTEIRO",
  "CASADO",
  "DIVORCIADO",
  "VIUVO",
  "UNIAO_ESTAVEL",
]);
export type MaritalStatus = z.infer<typeof MaritalStatusEnum>;

function validateCpf(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(digits[i]!) * (10 - i);
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(digits[9]!)) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(digits[i]!) * (11 - i);
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  return remainder === parseInt(digits[10]!);
}

// Valida dígitos verificadores e normaliza para só dígitos (remove máscara).
// "529.982.247-25" e "52998224725" são equivalentes e geram o mesmo valor
// persistido, garantindo que @@unique([organizationId, cpf]) detecte duplicatas
// independentemente da máscara enviada.
export const cpfSchema = z
  .string()
  .min(1)
  .refine((v) => validateCpf(v), { message: "CPF inválido" })
  .transform((v) => v.replace(/\D/g, ""));

// Helper: "" → undefined para campos opcionais de texto/enum/email.
// Decisa PATCH: "" em campo opcional é tratado como "não informado" (undefined),
// não como "limpar o campo" — use null explícito para limpar ownerDentistId.
function optionalText<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess(emptyStringToUndefined, schema.optional());
}

// Cadastro rápido: mínimo para agendamento e chegada (recepção)
export const quickCreatePatientSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
  ownerDentistId: z.preprocess(emptyStringToUndefined, z.string().optional()),
});
export type QuickCreatePatientInput = z.infer<typeof quickCreatePatientSchema>;

// Cadastro completo (modo paciente / ficha)
export const completePatientSchema = quickCreatePatientSchema.extend({
  birthDate: z.coerce.date().refine((d) => d <= new Date(), {
    message: "Data de nascimento não pode ser futura",
  }),
  sex: SexEnum,
  maritalStatus: MaritalStatusEnum,
  profession: z.string().min(1),
  email: z.string().email(),
  cpf: cpfSchema,
  address: z.string().min(1),
  preferredDrink: z.string().optional(),
  preferredMusic: z.string().optional(),
});
export type CompletePatientInput = z.infer<typeof completePatientSchema>;

// POST aceita quick ou complete — campos completos todos opcionais.
// Strings vazias são normalizadas para undefined antes de validar enum/email/cpf.
export const createPatientSchema = quickCreatePatientSchema.extend({
  birthDate: optionalCoercedDate,
  address: z.preprocess(emptyStringToUndefined, z.string().optional()),
  sex: optionalText(SexEnum),
  maritalStatus: optionalText(MaritalStatusEnum),
  profession: z.preprocess(emptyStringToUndefined, z.string().optional()),
  email: optionalText(z.string().email()),
  cpf: z.preprocess(emptyStringToUndefined, cpfSchema.optional()),
  preferredDrink: z.preprocess(emptyStringToUndefined, z.string().optional()),
  preferredMusic: z.preprocess(emptyStringToUndefined, z.string().optional()),
});
export type CreatePatientInput = z.infer<typeof createPatientSchema>;

// PATCH — "" é ignorado (não limpa o campo); para limpar ownerDentistId usar null.
export const updatePatientSchema = z.object({
  name: z.preprocess(emptyStringToUndefined, z.string().min(1).optional()),
  phone: z.preprocess(emptyStringToUndefined, z.string().min(1).optional()),
  birthDate: optionalCoercedDate,
  address: z.preprocess(emptyStringToUndefined, z.string().optional()),
  sex: optionalText(SexEnum),
  maritalStatus: optionalText(MaritalStatusEnum),
  profession: z.preprocess(emptyStringToUndefined, z.string().optional()),
  email: optionalText(z.string().email()),
  cpf: z.preprocess(emptyStringToUndefined, cpfSchema.optional()),
  preferredDrink: z.preprocess(emptyStringToUndefined, z.string().optional()),
  preferredMusic: z.preprocess(emptyStringToUndefined, z.string().optional()),
  ownerDentistId: z.string().nullable().optional(),
});
export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;

export function isPatientComplete(patient: {
  birthDate?: Date | string | null;
  sex?: string | null;
  maritalStatus?: string | null;
  profession?: string | null;
  email?: string | null;
  cpf?: string | null;
  address?: string | null;
}): boolean {
  return !!(
    patient.birthDate &&
    patient.sex &&
    patient.maritalStatus &&
    patient.profession &&
    patient.email &&
    patient.cpf &&
    patient.address
  );
}

export const sharePatientSchema = z.object({
  dentistId: z.string().min(1),
});
export type SharePatientInput = z.infer<typeof sharePatientSchema>;

export const bulkReassignPatientsSchema = z.object({
  fromDentistId: z.string().min(1),
  toDentistId: z.string().optional(),
});
export type BulkReassignPatientsInput = z.infer<typeof bulkReassignPatientsSchema>;

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
