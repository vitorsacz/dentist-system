import { apiClient } from "@/lib/api-client";
import type {
  CreatePatientInput,
  UpdatePatientInput,
  UpsertAnamnesisInput,
  CreateClinicalRecordInput,
  UpsertToothRecordInput,
  CreateBudgetInput,
} from "@dentist-system/shared-types";

export interface Patient {
  id: string;
  name: string;
  phone: string;
  birthDate: string | null;
  address: string | null;
  sex: "F" | "M" | null;
  maritalStatus: string | null;
  profession: string | null;
  email: string | null;
  cpf: string | null;
  preferredDrink: string | null;
  preferredMusic: string | null;
  ownerDentist: { id: string; name: string } | null;
  createdAt: string;
}

export interface PatientRevision {
  id: string;
  snapshot: Record<string, unknown>;
  changedAt: string;
  changedBy: { id: string; name: string };
}

export interface Anamnesis {
  allergies: string | null;
  medications: string | null;
  healthConditions: string | null;
  dentalHistory: string | null;
  chiefComplaint: string | null;
}

export interface ClinicalRecord {
  id: string;
  date: string;
  procedureNote: string;
  observations: string | null;
}

export interface ToothRecord {
  id: string;
  toothNumber: number;
  procedure: string;
  status: string;
  notes: string | null;
  updatedAt: string;
}

export interface BudgetItem {
  id: string;
  procedureId: string;
  toothNumber: number | null;
  value: number;
  notes: string | null;
  procedure: { name: string };
}

export interface Budget {
  id: string;
  status: string;
  createdAt: string;
  items: BudgetItem[];
  total: number;
}

export const patientsApi = {
  list: () => apiClient.get<Patient[]>("/patients"),
  findOne: (id: string) => apiClient.get<Patient>(`/patients/${id}`),
  create: (input: CreatePatientInput) => apiClient.post<Patient>("/patients", input),
  update: (id: string, input: UpdatePatientInput) => apiClient.patch<Patient>(`/patients/${id}`, input),
  getRevisions: (id: string) => apiClient.get<PatientRevision[]>(`/patients/${id}/revisions`),

  getAnamnesis: (patientId: string) => apiClient.get<Anamnesis | null>(`/patients/${patientId}/anamnesis`),
  upsertAnamnesis: (patientId: string, input: UpsertAnamnesisInput) =>
    apiClient.put<Anamnesis>(`/patients/${patientId}/anamnesis`, input),

  listClinicalRecords: (patientId: string) =>
    apiClient.get<ClinicalRecord[]>(`/patients/${patientId}/clinical-records`),
  createClinicalRecord: (patientId: string, input: CreateClinicalRecordInput) =>
    apiClient.post<ClinicalRecord>(`/patients/${patientId}/clinical-records`, input),

  listToothRecords: (patientId: string) =>
    apiClient.get<ToothRecord[]>(`/patients/${patientId}/tooth-records`),
  createToothRecord: (patientId: string, input: UpsertToothRecordInput) =>
    apiClient.post<ToothRecord>(`/patients/${patientId}/tooth-records`, input),
  updateToothRecordStatus: (patientId: string, id: string, status: string) =>
    apiClient.patch<ToothRecord>(`/patients/${patientId}/tooth-records/${id}/status`, { status }),

  listBudgets: (patientId: string) => apiClient.get<Budget[]>(`/budgets?patientId=${patientId}`),
  createBudget: (input: CreateBudgetInput) => apiClient.post<Budget>("/budgets", input),
  updateBudgetStatus: (id: string, status: string) =>
    apiClient.patch<Budget>(`/budgets/${id}/status`, { status }),
};
