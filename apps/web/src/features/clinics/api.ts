import { apiClient } from "@/lib/api-client";
import type { CreateClinicInput, PaletteColorToken, UpdateClinicInput } from "@dentist-system/shared-types";

export interface Clinic {
  id: string;
  name: string;
  type: "OWN" | "RENTED";
  dailyRentValue: number | null;
  colorToken: PaletteColorToken | null;
}

export const clinicsApi = {
  list: () => apiClient.get<Clinic[]>("/clinics"),
  create: (input: CreateClinicInput) => apiClient.post<Clinic>("/clinics", input),
  update: (id: string, input: UpdateClinicInput) => apiClient.patch<Clinic>(`/clinics/${id}`, input),
};
