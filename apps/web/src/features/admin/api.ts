import { apiClient } from "@/lib/api-client";
import type {
  CreateTenantUserInput,
  ManagedTenantUser,
  UpdateTenantUserInput,
  ResetPasswordInput,
} from "@dentist-system/shared-types";

export const adminUsersApi = {
  list: () => apiClient.get<ManagedTenantUser[]>("/users"),
  create: (input: CreateTenantUserInput) => apiClient.post<ManagedTenantUser>("/users", input),
  update: (userId: string, input: UpdateTenantUserInput) =>
    apiClient.patch<ManagedTenantUser>(`/users/${userId}`, input),
  resetPassword: (userId: string, input: ResetPasswordInput) =>
    apiClient.patch<ManagedTenantUser>(`/users/${userId}/password`, input),
};
