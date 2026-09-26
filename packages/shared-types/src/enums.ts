import { z } from "zod";

export const ROLES = ["ADMIN", "DENTIST", "RECEPTIONIST"] as const;
export type Role = (typeof ROLES)[number];

// Lista de papéis de um usuário de organização (R1: pode ter mais de um,
// ex.: ADMIN + DENTIST). Pelo menos um, sem repetição.
export const tenantRolesSchema = z
  .array(z.enum(ROLES))
  .min(1, "Escolha pelo menos um papel")
  .refine((roles) => new Set(roles).size === roles.length, "Papel repetido");

export const CLINIC_TYPES = ["OWN", "RENTED"] as const;
export type ClinicType = (typeof CLINIC_TYPES)[number];

export const BUDGET_STATUSES = ["PENDING", "APPROVED", "IN_PROGRESS", "COMPLETED"] as const;
export type BudgetStatus = (typeof BUDGET_STATUSES)[number];

export const APPOINTMENT_STATUSES = ["SCHEDULED", "DONE", "CANCELED", "NO_SHOW"] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export const TOOTH_RECORD_STATUSES = ["PLANNED", "DONE"] as const;
export type ToothRecordStatus = (typeof TOOTH_RECORD_STATUSES)[number];

export const RECALL_STATUSES = ["PENDING", "DONE", "CANCELED"] as const;
export type RecallStatus = (typeof RECALL_STATUSES)[number];

export const TENANT_TYPES = ["CLINIC", "FREELANCER"] as const;
export type TenantType = (typeof TENANT_TYPES)[number];

export const PALETTE_COLOR_TOKENS = ["BRAND", "SUCCESS", "WARNING", "ERROR", "INFO"] as const;
export type PaletteColorToken = (typeof PALETTE_COLOR_TOKENS)[number];

export const LOCATION_RELATIONSHIP_TYPES = ["RENTED_FIXED", "COMMISSION", "PER_SERVICE"] as const;
export type LocationRelationshipType = (typeof LOCATION_RELATIONSHIP_TYPES)[number];

export const RENT_PERIODICITIES = ["DAILY", "WEEKLY", "MONTHLY"] as const;
export type RentPeriodicity = (typeof RENT_PERIODICITIES)[number];

export const ORGANIZATION_STATUSES = ["ACTIVE", "SUSPENDED", "DELETED"] as const;
export type OrganizationStatus = (typeof ORGANIZATION_STATUSES)[number];
