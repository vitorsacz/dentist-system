import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { AppointmentStatus, CurrentUser, TenantType } from "@dentist-system/shared-types";
import { can } from "@/lib/access";
import { clinicsApi, type Clinic } from "@/features/clinics/api";
import { myClinicApi } from "@/features/my-clinic/api";
import { fromApiColorToken, locationColorForIndex, type LocationColorToken } from "./location-colors";

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

const FAKE_PATIENTS = [
  { name: "Carlos Eduardo Ferreira", phone: "(11) 98765-4321" },
  { name: "Marina Souza", phone: "(11) 91234-5678" },
  { name: "João Pedro Lima", phone: "(11) 99887-6655" },
  { name: "Ana Beatriz Costa", phone: "(11) 98123-4567" },
  { name: "Roberta Alves", phone: "(11) 97654-3210" },
  { name: "Felipe Torres", phone: "(11) 96543-2109" },
];
const FAKE_PROCEDURES = [
  "Consulta / avaliação",
  "Limpeza (profilaxia)",
  "Restauração (resina)",
  "Extração simples",
  "Canal (endodontia)",
  "Clareamento dental",
];
const FAKE_STATUSES: AppointmentStatus[] = ["SCHEDULED", "SCHEDULED", "SCHEDULED", "DONE", "CANCELED", "NO_SHOW"];

function startOfWeek(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // segunda-feira
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Calendários continuam mockados nesta rodada (só o roster — consultório e
// dentista — virou real, ver hook abaixo). Pra "dentist" (clínica, admin/
// recepcionista): todo par (consultório real, dentista real). Pra
// "location" (freelancer) e "none" (dentista de clínica, só a própria
// agenda): um calendário por consultório, sempre do usuário logado.
function buildCalendars(
  axis: CalendarAxis,
  locations: MockLocation[],
  dentists: MockDentist[],
  currentUser: Pick<CurrentUser, "id" | "name"> | null,
): MockCalendar[] {
  if (axis === "dentist") {
    const calendars: MockCalendar[] = [];
    locations.forEach((location) => {
      dentists.forEach((dentist) => {
        calendars.push({
          id: `cal-${location.id}-${dentist.id}`,
          locationId: location.id,
          dentistUserId: dentist.id,
          dentistName: dentist.name,
        });
      });
    });
    return calendars;
  }

  return locations.map((location) => ({
    id: `cal-${location.id}-self`,
    locationId: location.id,
    dentistUserId: currentUser?.id ?? "self",
    dentistName: currentUser?.name ?? "",
  }));
}

function buildAppointments(calendars: MockCalendar[]): MockAppointment[] {
  const weekStart = startOfWeek(new Date());
  const appointments: MockAppointment[] = [];
  let seed = 0;

  calendars.forEach((calendar) => {
    const count = 4 + (seed % 3);
    for (let i = 0; i < count; i++) {
      const dayOffset = seed % 5; // seg a sex
      const hour = 8 + (seed % 9); // 08h-16h
      const durationMinutes = 30 + (seed % 3) * 15;

      const start = new Date(weekStart);
      start.setDate(start.getDate() + dayOffset);
      start.setHours(hour, seed % 2 === 0 ? 0 : 30, 0, 0);
      const end = new Date(start.getTime() + durationMinutes * 60_000);

      const patient = FAKE_PATIENTS[seed % FAKE_PATIENTS.length]!;

      appointments.push({
        id: `appt-${calendar.id}-${i}`,
        calendarId: calendar.id,
        locationId: calendar.locationId,
        dentistUserId: calendar.dentistUserId,
        patientName: patient.name,
        patientPhone: patient.phone,
        procedureName: FAKE_PROCEDURES[seed % FAKE_PROCEDURES.length]!,
        start,
        end,
        status: FAKE_STATUSES[seed % FAKE_STATUSES.length]!,
      });
      seed++;
    }
  });

  // Overlap proposital entre dois dentistas diferentes, mesmo consultório
  // e mesmo horário — só pra dar pra ver de verdade o layout lado a lado
  // (slotEventOverlap=false) na visão admin/recepcionista.
  const first = calendars[0];
  const second = calendars[1];
  if (first && second && first.locationId === second.locationId) {
    const overlapStart = new Date(weekStart);
    overlapStart.setDate(overlapStart.getDate() + 2);
    overlapStart.setHours(10, 0, 0, 0);
    const overlapEnd = new Date(overlapStart.getTime() + 45 * 60_000);
    appointments.push(
      {
        id: `appt-overlap-${first.id}`,
        calendarId: first.id,
        locationId: first.locationId,
        dentistUserId: first.dentistUserId,
        patientName: "Renata Xavier",
        patientPhone: "(11) 95555-1010",
        procedureName: "Consulta / avaliação",
        start: overlapStart,
        end: overlapEnd,
        status: "SCHEDULED",
      },
      {
        id: `appt-overlap-${second.id}`,
        calendarId: second.id,
        locationId: second.locationId,
        dentistUserId: second.dentistUserId,
        patientName: "Igor Menezes",
        patientPhone: "(11) 95555-2020",
        procedureName: "Limpeza (profilaxia)",
        start: overlapStart,
        end: overlapEnd,
        status: "SCHEDULED",
      },
    );
  }

  return appointments;
}

export function useAgendaData(currentUser: CurrentUser | null) {
  const orgQuery = useQuery({ queryKey: ["my-clinic"], queryFn: myClinicApi.get });
  const clinicsQuery = useQuery({ queryKey: ["clinics"], queryFn: clinicsApi.list });

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
      id: dentist.userId,
      name: dentist.name,
      colorToken: fromApiColorToken(dentist.colorToken) ?? locationColorForIndex(index),
    }));
  }, [axis, dentistsQuery.data]);

  const calendars = useMemo(
    () => buildCalendars(axis, locations, dentists, currentUser),
    [axis, locations, dentists, currentUser],
  );

  const appointments = useMemo(() => buildAppointments(calendars), [calendars]);

  return {
    axis,
    locations,
    dentists,
    calendars,
    appointments,
    isLoading: orgQuery.isLoading || clinicsQuery.isLoading || (axis === "dentist" && dentistsQuery.isLoading),
  };
}
