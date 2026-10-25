import { apiClient } from "@/lib/api-client";
import type { CreateClinicInput, PaletteColorToken, UpdateClinicInput } from "@dentist-system/shared-types";

export interface Clinic {
  id: string;
  name: string;
  type: "OWN" | "RENTED";
  dailyRentValue: number | null;
  colorToken: PaletteColorToken | null;
  active: boolean;
}

export const clinicsApi = {
  list: (params?: { includeInactive?: boolean }) => {
    const qs = params?.includeInactive ? "?includeInactive=true" : "";
    return apiClient.get<Clinic[]>(`/clinics${qs}`);
  },
  create: (input: CreateClinicInput) => apiClient.post<Clinic>("/clinics", input),
  update: (id: string, input: UpdateClinicInput) => apiClient.patch<Clinic>(`/clinics/${id}`, input),
  toggleActive: (id: string, active: boolean) => apiClient.patch<Clinic>(`/clinics/${id}/active`, { active }),
};
