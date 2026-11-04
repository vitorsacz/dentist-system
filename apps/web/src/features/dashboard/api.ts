import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { AppointmentStatus } from "@dentist-system/shared-types";

export interface DashboardAppointment {
  id: string;
  time: string;
  patientName: string;
  clinicName: string;
  status: AppointmentStatus;
}

export interface DashboardOverview {
  appointmentsToday: DashboardAppointment[];
  appointmentsThisWeek: number;
  activePatients: number;
  attendancesThisMonth: number;
  revenueThisMonth?: number;
  revenueByClinic?: { clinicId: string; clinicName: string; revenue: number }[];
}

export function useDashboardOverview() {
  return useQuery({
    queryKey: ["dashboard", "overview"],
    queryFn: () => apiClient.get<DashboardOverview>("/dashboard/overview"),
  });
}
