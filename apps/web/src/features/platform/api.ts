import { apiClient } from "@/lib/api-client";
import type { CreateOrganizationInput, PlatformOrganization } from "@dentist-system/shared-types";

export const platformApi = {
  listOrganizations: () => apiClient.get<PlatformOrganization[]>("/platform/organizations"),
  createOrganization: (input: CreateOrganizationInput) =>
    apiClient.post<PlatformOrganization>("/platform/organizations", input),
};
