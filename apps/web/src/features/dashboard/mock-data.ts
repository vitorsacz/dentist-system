import { useQuery } from "@tanstack/react-query";
import type { AppointmentStatus, BudgetStatus } from "@dentist-system/shared-types";

export interface TodayAppointmentMock {
  id: string;
  time: string;
  patientName: string;
  clinicName: string;
  status: AppointmentStatus;
}

export interface DashboardOverviewMock {
  activeDentists: number;
  patientsAttendedThisMonth: number;
  revenueThisMonth: number;
  agendaOccupancyPercent: number;
  revenueByMonth: { month: string; revenue: number }[];
  budgetsByStatus: { status: BudgetStatus; count: number }[];
  monthlyGoalPercent: number;
  todayAppointments: TodayAppointmentMock[];
  hasIncompleteProfile: boolean;
}

const MOCK_OVERVIEW: DashboardOverviewMock = {
  activeDentists: 3,
  patientsAttendedThisMonth: 47,
  revenueThisMonth: 18420,
  agendaOccupancyPercent: 72,
  revenueByMonth: [
    { month: "abr/26", revenue: 12800 },
    { month: "mai/26", revenue: 14200 },
    { month: "jun/26", revenue: 13650 },
    { month: "jul/26", revenue: 16900 },
    { month: "ago/26", revenue: 15300 },
    { month: "set/26", revenue: 18420 },
  ],
  budgetsByStatus: [
    { status: "PENDING", count: 8 },
    { status: "APPROVED", count: 14 },
    { status: "IN_PROGRESS", count: 6 },
    { status: "COMPLETED", count: 22 },
  ],
  monthlyGoalPercent: 78,
  todayAppointments: [
    { id: "1", time: "09:00", patientName: "Carlos Eduardo Ferreira", clinicName: "Consultório Centro", status: "SCHEDULED" },
    { id: "2", time: "10:30", patientName: "Marina Souza", clinicName: "Consultório Centro", status: "SCHEDULED" },
    { id: "3", time: "14:00", patientName: "João Pedro Lima", clinicName: "Consultório Zona Sul", status: "DONE" },
    { id: "4", time: "16:15", patientName: "Ana Beatriz Costa", clinicName: "Consultório Centro", status: "SCHEDULED" },
  ],
  hasIncompleteProfile: true,
};

function fetchMockOverview(): Promise<DashboardOverviewMock> {
  return new Promise((resolve) => setTimeout(() => resolve(MOCK_OVERVIEW), 600));
}

export function useMockDashboardOverview() {
  return useQuery({ queryKey: ["dashboard", "overview", "mock"], queryFn: fetchMockOverview });
}
