import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { CreateProcedureInput, UpdateProcedureInput } from "@dentist-system/shared-types";

export interface Procedure {
  id: string;
  name: string;
  defaultValue: number;
  active: boolean;
}

const QUERY_KEY = ["procedures"] as const;

export const proceduresApi = {
  list: () => apiClient.get<Procedure[]>("/procedures"),
  create: (input: CreateProcedureInput) => apiClient.post<Procedure>("/procedures", input),
  update: (id: string, input: UpdateProcedureInput) => apiClient.patch<Procedure>(`/procedures/${id}`, input),
  softDelete: (id: string) => apiClient.delete<Procedure>(`/procedures/${id}`),
};

export function useProcedures() {
  return useQuery({ queryKey: QUERY_KEY, queryFn: () => proceduresApi.list() });
}

export function useCreateProcedure() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProcedureInput) => proceduresApi.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useUpdateProcedure() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateProcedureInput }) => proceduresApi.update(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useSoftDeleteProcedure() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => proceduresApi.softDelete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}
