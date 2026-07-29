import { apiClient } from "@/lib/api-client";
import type { CreateProcedureInput, UpdateProcedureInput } from "@dentist-system/shared-types";

export interface Procedure {
  id: string;
  name: string;
  defaultValue: number;
  active: boolean;
}

export const proceduresApi = {
  list: () => apiClient.get<Procedure[]>("/procedures"),
  create: (input: CreateProcedureInput) => apiClient.post<Procedure>("/procedures", input),
  update: (id: string, input: UpdateProcedureInput) =>
    apiClient.patch<Procedure>(`/procedures/${id}`, input),
};
