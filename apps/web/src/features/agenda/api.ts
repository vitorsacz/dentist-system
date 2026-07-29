import { apiClient } from "@/lib/api-client";
import type { CreateAppointmentInput, UpdateAppointmentInput } from "@dentist-system/shared-types";

export interface Appointment {
  id: string;
  startsAt: string;
  status: "SCHEDULED" | "DONE" | "CANCELED" | "NO_SHOW";
  notes: string | null;
  patient: { id: string; name: string };
  clinic: { id: string; name: string };
}

export const appointmentsApi = {
  list: (from: string, to: string, clinicId?: string) =>
    apiClient.get<Appointment[]>(
      `/appointments?from=${from}&to=${to}${clinicId ? `&clinicId=${clinicId}` : ""}`,
    ),
  create: (input: CreateAppointmentInput) => apiClient.post<Appointment>("/appointments", input),
  update: (id: string, input: UpdateAppointmentInput) =>
    apiClient.patch<Appointment>(`/appointments/${id}`, input),
};
