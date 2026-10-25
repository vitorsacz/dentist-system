import { apiClient } from "@/lib/api-client";
import type { AppointmentStatus, ConflictInfo } from "@dentist-system/shared-types";

export type { ConflictInfo };

export interface AppointmentListItem {
  id: string;
  patientId: string;
  clinicId: string;
  dentistUserId: string;
  startsAt: string;
  endsAt: string;
  status: AppointmentStatus;
  notes: string | null;
  patient: { id: string; name: string; phone: string | null; active: boolean };
  clinic: { id: string; name: string; colorToken: string | null };
}

export interface ListAppointmentsParams {
  from: Date;
  to: Date;
  clinicId?: string;
  dentistUserId?: string;
}

export interface CreateAppointmentBody {
  patientId: string;
  clinicId: string;
  dentistUserId: string;
  startsAt: string;
  endsAt: string;
  notes?: string;
  allowOverlap?: boolean;
}

export interface UpdateAppointmentBody {
  clinicId?: string;
  dentistUserId?: string;
  startsAt?: string;
  endsAt?: string;
  status?: AppointmentStatus;
  notes?: string;
  allowOverlap?: boolean;
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
  create: (body: CreateAppointmentBody) =>
    apiClient.post<AppointmentListItem>("/appointments", body),
  update: (id: string, body: UpdateAppointmentBody) =>
    apiClient.patch<AppointmentListItem>(`/appointments/${id}`, body),
  cancel: (id: string) =>
    apiClient.patch<AppointmentListItem>(`/appointments/${id}/cancel`),
};
