import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { AppointmentStatus, CurrentUser } from "@dentist-system/shared-types";
import { clinicsApi, type Clinic } from "@/features/clinics/api";
import { locationColorForIndex, type LocationColorToken } from "./location-colors";
import { loadDentists, type MockDentist } from "./dentist-store";

export interface MockLocation {
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

function buildCalendars(
  locations: MockLocation[],
  currentUser: Pick<CurrentUser, "id" | "name" | "role"> | null,
  dentistRoster: MockDentist[],
) {
  const calendars: MockCalendar[] = [];
  locations.forEach((location, index) => {
    if (currentUser?.role === "DENTIST" && index === 0) {
      // Calendário "de verdade" do dentista logado — RBAC mock: só ele
      // enxerga este calendário quando role === DENTIST (ver useAgendaMockData).
      calendars.push({
        id: `cal-${location.id}-self`,
        locationId: location.id,
        dentistUserId: currentUser.id,
        dentistName: currentUser.name,
      });
    } else {
      const dentist = dentistRoster[index % dentistRoster.length];
      calendars.push({
        id: `cal-${location.id}-1`,
        locationId: location.id,
        dentistUserId: dentist?.id ?? `mock-dentist-${index}`,
        dentistName: dentist?.name ?? "Dentista",
      });
    }
    const extraDentist = dentistRoster[(index + 1) % dentistRoster.length];
    calendars.push({
      id: `cal-${location.id}-2`,
      locationId: location.id,
      dentistUserId: extraDentist?.id ?? `mock-dentist-extra-${index}`,
      dentistName: extraDentist?.name ?? "Dentista",
    });
  });
  return calendars;
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

export function useAgendaMockData(currentUser: CurrentUser | null) {
  const clinicsQuery = useQuery({ queryKey: ["clinics"], queryFn: clinicsApi.list });
  const [dentistRosterVersion, setDentistRosterVersion] = useState(0);

  function refreshDentists() {
    setDentistRosterVersion((v) => v + 1);
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps -- dentistRosterVersion é só um gatilho pra reler o localStorage
  const fullDentistRoster = useMemo(() => loadDentists(), [dentistRosterVersion]);

  // RBAC mockado no cliente — só uma maquete do comportamento esperado.
  // Dentista logado nunca recebe o roster (a sidebar por dentista não deve
  // nem ter dados pra mostrar); admin/recepcionista veem todo o roster da
  // clínica. Quando existir backend de verdade, esse filtro precisa
  // acontecer no servidor (ver Obsidian "Implementação da Agenda
  // Multi-Consultório — Plano Técnico"), nunca só aqui.
  const dentists = currentUser?.role === "DENTIST" ? [] : fullDentistRoster;

  const { locations, calendars } = useMemo(() => {
    const clinics: Clinic[] = clinicsQuery.data ?? [];
    const allLocations = clinics.map((clinic, index) => ({
      id: clinic.id,
      name: clinic.name,
      colorToken: locationColorForIndex(index),
    }));
    const allCalendars = buildCalendars(allLocations, currentUser, fullDentistRoster);

    const visibleCalendars =
      currentUser?.role === "DENTIST"
        ? allCalendars.filter((cal) => cal.dentistUserId === currentUser.id)
        : allCalendars;
    const visibleLocationIds = new Set(visibleCalendars.map((cal) => cal.locationId));
    const visibleLocations = allLocations.filter((loc) => visibleLocationIds.has(loc.id));

    return { locations: visibleLocations, calendars: visibleCalendars };
  }, [clinicsQuery.data, currentUser, fullDentistRoster]);

  const appointments = useMemo(() => buildAppointments(calendars), [calendars]);

  return {
    locations,
    calendars,
    dentists,
    appointments,
    isLoading: clinicsQuery.isLoading,
    refreshDentists,
  };
}
