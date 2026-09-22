import { apiClient } from "@/lib/api-client";
import type { MyClinic, OrganizationDentist } from "@dentist-system/shared-types";

export const myClinicApi = {
  get: () => apiClient.get<MyClinic>("/organization"),
  dentists: () => apiClient.get<OrganizationDentist[]>("/organization/dentists"),
};
