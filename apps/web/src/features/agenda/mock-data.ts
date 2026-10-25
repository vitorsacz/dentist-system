import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { AppointmentStatus, CurrentUser, TenantType } from "@dentist-system/shared-types";
import { can } from "@/lib/access";
import { clinicsApi, type Clinic } from "@/features/clinics/api";
import { myClinicApi } from "@/features/my-clinic/api";
import { fromApiColorToken, locationColorForIndex, type LocationColorToken } from "./location-colors";
import { appointmentsApi } from "./api";

export interface MockLocation {
  id: string;
  name: string;
  colorToken: LocationColorToken;
}

export interface MockDentist {
  id: string;
  name: string;
  colorToken: LocationColorToken;
}

export interface MockCalendar {
  id: string;
  locationId: string;
  dentistUserId: string;
  dentistName: string;
}

export interface MockAppointment {
  id: string;
  calendarId: string;
  locationId: string;
  dentistUserId: string;
  patientName: string;
  patientPhone: string;
  procedureName: string;
  start: Date;
  end: Date;
  status: AppointmentStatus;
  patientActive?: boolean;
}

// Qual eixo a sidebar de calendários mostra — decisão centralizada aqui
// (única fonte de verdade, ver vault "Conectar Agenda a Dados Reais de
// Consultório e Dentistas — Plano Técnico"), nunca espalhada em
// componente. Freelancer sempre agrupa por consultório (mesmo sendo
// sempre DENTIST, o tipo do tenant decide primeiro); clínica agrupa por
// dentista pro admin/recepcionista, e não mostra sidebar nenhuma pro
// dentista (já decidido — ele só vê a própria agenda).
export type CalendarAxis = "location" | "dentist" | "none";

// O tipo de organização decide primeiro (regra de negócio, fora da matriz
// de acesso); dentro da clínica, o eixo "dentista" é pra quem pode listar os
// dentistas (capacidade organization.dentists).
export function resolveCalendarAxis(organizationType: TenantType, canListDentists: boolean): CalendarAxis {
  if (organizationType === "FREELANCER") return "location";
  return canListDentists ? "dentist" : "none";
}

export function useAgendaData(currentUser: CurrentUser | null, from: Date, to: Date, clinicId?: string) {
  const orgQuery = useQuery({ queryKey: ["my-clinic"], queryFn: myClinicApi.get });
  const clinicsQuery = useQuery({ queryKey: ["clinics"], queryFn: () => clinicsApi.list() });

  // Enquanto o tipo do tenant não carregou, assume o eixo mais restrito
  // ("none") em vez de arriscar mostrar a sidebar errada por um instante.
  const axis: CalendarAxis = orgQuery.data
    ? resolveCalendarAxis(orgQuery.data.type, can(currentUser, "organization.dentists"))
    : "none";

  const dentistsQuery = useQuery({
    queryKey: ["organization", "dentists"],
    queryFn: myClinicApi.dentists,
    enabled: axis === "dentist",
  });

  const appointmentsQuery = useQuery({
    queryKey: ["appointments", from.toISOString(), to.toISOString(), clinicId],
    queryFn: () => appointmentsApi.list({ from, to, clinicId }),
  });

  const locations: MockLocation[] = useMemo(() => {
    const clinics: Clinic[] = clinicsQuery.data ?? [];
    return clinics.map((clinic, index) => ({
      id: clinic.id,
      name: clinic.name,
      colorToken: fromApiColorToken(clinic.colorToken) ?? locationColorForIndex(index),
    }));
  }, [clinicsQuery.data]);

  const dentists: MockDentist[] = useMemo(() => {
    if (axis !== "dentist") return [];
    const roster = dentistsQuery.data ?? [];
    return roster.map((dentist, index) => ({
      id: dentist.id,
      name: dentist.name,
      colorToken: fromApiColorToken(dentist.colorToken) ?? locationColorForIndex(index),
    }));
  }, [axis, dentistsQuery.data]);

  const appointments: MockAppointment[] = useMemo(
    () =>
      (appointmentsQuery.data ?? []).map((appt) => ({
        id: appt.id,
        calendarId: appt.id,
        locationId: appt.clinicId,
        dentistUserId: appt.dentistUserId,
        patientName: appt.patient.name,
        patientPhone: appt.patient.phone ?? "",
        procedureName: appt.notes ?? "",
        start: new Date(appt.startsAt),
        end: new Date(appt.endsAt),
        status: appt.status,
      })),
    [appointmentsQuery.data],
  );

  return {
    axis,
    locations,
    dentists,
    appointments,
    appointmentsQuery,
    isLoading: orgQuery.isLoading || clinicsQuery.isLoading || (axis === "dentist" && dentistsQuery.isLoading),
  };
}
