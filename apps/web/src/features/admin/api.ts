import { apiClient } from "@/lib/api-client";
import type { CreateUserInput, ManagedUser, UpdateUserInput } from "@dentist-system/shared-types";

export const adminUsersApi = {
  list: () => apiClient.get<ManagedUser[]>("/users"),
  create: (input: CreateUserInput) => apiClient.post<ManagedUser>("/users", input),
  update: (id: string, input: UpdateUserInput) => apiClient.patch<ManagedUser>(`/users/${id}`, input),
};
