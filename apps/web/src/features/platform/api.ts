import { apiClient } from "@/lib/api-client";
import type {
  CreateOrganizationInput,
  PlatformOrganization,
  PlatformOrganizationDetail,
  PlatformOverviewStats,
} from "@dentist-system/shared-types";

export const platformApi = {
  listOrganizations: () => apiClient.get<PlatformOrganization[]>("/platform/organizations"),
  createOrganization: (input: CreateOrganizationInput) =>
    apiClient.post<PlatformOrganization>("/platform/organizations", input),
  getOverviewStats: () => apiClient.get<PlatformOverviewStats>("/platform/stats/overview"),
  getOrganizationDetail: (id: string) =>
    apiClient.get<PlatformOrganizationDetail>(`/platform/organizations/${id}`),
};
