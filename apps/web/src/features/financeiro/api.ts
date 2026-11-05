import { apiClient, getAccessToken } from "@/lib/api-client";
import type {
  CreateAttendanceInput,
  FinancialReport,
  ClinicFinancialTerms,
  UpsertClinicFinancialTermsInput,
} from "@dentist-system/shared-types";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export const attendancesApi = {
  create: (input: CreateAttendanceInput) => apiClient.post("/attendances", input),
};

export const reportsApi = {
  financial: (from: string, to: string, clinicId?: string, dentistUserId?: string) =>
    apiClient.get<FinancialReport>(
      `/reports/financial?from=${from}&to=${to}${clinicId ? `&clinicId=${clinicId}` : ""}${dentistUserId ? `&dentistUserId=${dentistUserId}` : ""}`,
    ),

  csvDownload: async (from: string, to: string): Promise<Blob> => {
    const token = getAccessToken();
    const url = `${API_URL}/reports/financial/csv?from=${from}&to=${to}`;
    const res = await fetch(url, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      credentials: "include",
    });
    if (!res.ok) throw new Error(`CSV download falhou: ${res.status}`);
    return res.blob();
  },
};

export const clinicTermsApi = {
  get: (clinicId: string) =>
    apiClient.get<ClinicFinancialTerms | null>(`/clinics/${clinicId}/financial-terms`),
  upsert: (clinicId: string, input: UpsertClinicFinancialTermsInput) =>
    apiClient.put<ClinicFinancialTerms>(`/clinics/${clinicId}/financial-terms`, input),
};
