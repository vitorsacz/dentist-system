import { apiClient } from "@/lib/api-client";
import type { MyClinic } from "@dentist-system/shared-types";

export const myClinicApi = {
  get: () => apiClient.get<MyClinic>("/organization"),
};
