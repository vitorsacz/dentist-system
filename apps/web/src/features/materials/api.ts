import { apiClient } from "@/lib/api-client";
import type { CreateMaterialBatchInput, CreateMaterialInput } from "@dentist-system/shared-types";

export interface MaterialBatch {
  id: string;
  quantity: number;
  expiryDate: string | null;
}

export interface Material {
  id: string;
  name: string;
  unit: string;
  minimumStock: number;
  currentStock: number;
  lowStock: boolean;
  expiringSoon: boolean;
  batches: MaterialBatch[];
}

export const materialsApi = {
  list: () => apiClient.get<Material[]>("/materials"),
  create: (input: CreateMaterialInput) => apiClient.post<Material>("/materials", input),
  addBatch: (materialId: string, input: CreateMaterialBatchInput) =>
    apiClient.post<MaterialBatch>(`/materials/${materialId}/batches`, input),
};
