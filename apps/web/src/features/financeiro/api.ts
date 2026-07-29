import { apiClient } from "@/lib/api-client";
import type { CreateAttendanceInput, FinancialReport } from "@dentist-system/shared-types";

export const attendancesApi = {
  create: (input: CreateAttendanceInput) => apiClient.post("/attendances", input),
};

export const reportsApi = {
  financial: (from: string, to: string, clinicId?: string) =>
    apiClient.get<FinancialReport>(
      `/reports/financial?from=${from}&to=${to}${clinicId ? `&clinicId=${clinicId}` : ""}`,
    ),
};
