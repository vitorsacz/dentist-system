import { apiClient } from "@/lib/api-client";
import type {
  CreateUserInput,
  ManagedUser,
  UpdateUserInput,
  ResetPasswordInput,
} from "@dentist-system/shared-types";

export const adminUsersApi = {
  list: () => apiClient.get<ManagedUser[]>("/users"),
  create: (input: CreateUserInput) => apiClient.post<ManagedUser>("/users", input),
  update: (id: string, input: UpdateUserInput) => apiClient.patch<ManagedUser>(`/users/${id}`, input),
  resetPassword: (id: string, input: ResetPasswordInput) =>
    apiClient.patch<ManagedUser>(`/users/${id}/password`, input),
};
