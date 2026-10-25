import { apiClient } from "@/lib/api-client";
import type { AppointmentStatus } from "@dentist-system/shared-types";

export interface AppointmentListItem {
  id: string;
  patientId: string;
  clinicId: string;
  dentistUserId: string;
  startsAt: string;
  endsAt: string;
  status: AppointmentStatus;
  notes: string | null;
  patient: { id: string; name: string; phone: string | null };
  clinic: { id: string; name: string };
}

export interface ListAppointmentsParams {
  from: Date;
  to: Date;
  clinicId?: string;
  dentistUserId?: string;
}

export const appointmentsApi = {
  list: (params: ListAppointmentsParams) => {
    const qs = new URLSearchParams({
      from: params.from.toISOString(),
      to: params.to.toISOString(),
    });
    if (params.clinicId) qs.set("clinicId", params.clinicId);
    if (params.dentistUserId) qs.set("dentistUserId", params.dentistUserId);
    return apiClient.get<AppointmentListItem[]>(`/appointments?${qs}`);
  },
};
