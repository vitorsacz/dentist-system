import { apiClient } from "@/lib/api-client";
import type {
  CreateMembershipUserInput,
  ManagedMembership,
  UpdateMembershipInput,
  ResetPasswordInput,
} from "@dentist-system/shared-types";

export const adminUsersApi = {
  list: () => apiClient.get<ManagedMembership[]>("/users"),
  create: (input: CreateMembershipUserInput) => apiClient.post<ManagedMembership>("/users", input),
  update: (membershipId: string, input: UpdateMembershipInput) =>
    apiClient.patch<ManagedMembership>(`/users/${membershipId}`, input),
  resetPassword: (membershipId: string, input: ResetPasswordInput) =>
    apiClient.patch<ManagedMembership>(`/users/${membershipId}/password`, input),
};
