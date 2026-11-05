import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type {
  CreateAnamnesisQuestionInput,
  UpdateAnamnesisQuestionInput,
  ReorderAnamnesisQuestionsInput,
} from "@dentist-system/shared-types";

export interface AnamnesisQuestion {
  id: string;
  key: string;
  label: string;
  kind: "YES_NO" | "TEXT";
  detailRequiredWhenYes: boolean;
  alertWhenYes: boolean;
  sensitive: boolean;
  active: boolean;
  order: number;
  deletedAt: string | null;
}

export interface LibraryQuestion {
  key: string;
  label: string;
  kind: "YES_NO" | "TEXT";
  detailRequiredWhenYes: boolean;
  alertWhenYes: boolean;
  sensitive: boolean;
  defaultActive: boolean;
  order: number;
}

export interface SeedResult {
  created: number;
  reactivated: number;
}

const QK = ["anamnesis-questions"] as const;
const LIB_QK = ["anamnesis-questions", "library"] as const;

export const anamnesisQuestionsApi = {
  list: () => apiClient.get<AnamnesisQuestion[]>("/anamnesis-questions"),
  library: () => apiClient.get<LibraryQuestion[]>("/anamnesis-questions/library"),
  seedLibrary: () => apiClient.post<SeedResult>("/anamnesis-questions/seed-library", {}),
  create: (input: CreateAnamnesisQuestionInput) =>
    apiClient.post<AnamnesisQuestion>("/anamnesis-questions", input),
  update: (id: string, input: UpdateAnamnesisQuestionInput) =>
    apiClient.patch<AnamnesisQuestion>(`/anamnesis-questions/${id}`, input),
  toggleActive: (id: string) =>
    apiClient.patch<AnamnesisQuestion>(`/anamnesis-questions/${id}/active`, {}),
  softDelete: (id: string) =>
    apiClient.delete<AnamnesisQuestion>(`/anamnesis-questions/${id}`),
  reorder: (input: ReorderAnamnesisQuestionsInput) =>
    apiClient.post<AnamnesisQuestion[]>("/anamnesis-questions/reorder", input),
};

export function useAnamnesisQuestions() {
  return useQuery({ queryKey: QK, queryFn: () => anamnesisQuestionsApi.list() });
}

export function useAnamnesisLibrary() {
  return useQuery({ queryKey: LIB_QK, queryFn: () => anamnesisQuestionsApi.library(), enabled: false });
}

export function useSeedLibrary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => anamnesisQuestionsApi.seedLibrary(),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useCreateAnamnesisQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAnamnesisQuestionInput) => anamnesisQuestionsApi.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useUpdateAnamnesisQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateAnamnesisQuestionInput }) =>
      anamnesisQuestionsApi.update(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useToggleAnamnesisQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => anamnesisQuestionsApi.toggleActive(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useSoftDeleteAnamnesisQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => anamnesisQuestionsApi.softDelete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useReorderAnamnesisQuestions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => anamnesisQuestionsApi.reorder({ ids }),
    onMutate: async (ids) => {
      await qc.cancelQueries({ queryKey: QK });
      const prev = qc.getQueryData<AnamnesisQuestion[]>(QK);
      qc.setQueryData<AnamnesisQuestion[]>(QK, (old) => {
        if (!old) return old;
        const byId = new Map(old.map((q) => [q.id, q]));
        // Rebuild list: ordered ids first, then remaining (in case partial reorder)
        const reordered = ids.map((id) => byId.get(id)).filter(Boolean) as AnamnesisQuestion[];
        const rest = old.filter((q) => !ids.includes(q.id));
        return [...reordered, ...rest];
      });
      return { prev };
    },
    onError: (_err, _ids, ctx) => {
      if (ctx?.prev) qc.setQueryData(QK, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: QK }),
  });
}
