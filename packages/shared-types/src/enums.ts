export const ROLES = ["ADMIN", "DENTIST", "RECEPTIONIST"] as const;
export type Role = (typeof ROLES)[number];

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

export const ORGANIZATION_STATUSES = ["ACTIVE", "SUSPENDED", "DELETED"] as const;
export type OrganizationStatus = (typeof ORGANIZATION_STATUSES)[number];
