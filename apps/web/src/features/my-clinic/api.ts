import { apiClient } from "@/lib/api-client";
import type { MyClinic, OrganizationDentist, UpdateOrganizationProfileInput } from "@dentist-system/shared-types";

export const myClinicApi = {
  get: () => apiClient.get<MyClinic>("/organization"),
  update: (input: UpdateOrganizationProfileInput) => apiClient.patch<void>("/organization", input),
  dentists: (includeInactive = false) =>
    apiClient.get<OrganizationDentist[]>(
      `/organization/dentists${includeInactive ? "?includeInactive=true" : ""}`,
    ),
};
