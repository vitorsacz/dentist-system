import { useEffect, useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { DateSelectArg, DatesSetArg, EventClickArg, EventContentArg } from "@fullcalendar/core";
import { ChevronDown, Plus } from "lucide-react";
import type { AppointmentStatus } from "@dentist-system/shared-types";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/ui/page-header";
import { CalendarSidebar } from "./calendar-sidebar";
import { DentistSidebar } from "./dentist-sidebar";
import { AppointmentCreateModal } from "./appointment-create-modal";
import { AppointmentDetailPanel } from "./appointment-detail-panel";
import { useAgendaMockData, type MockAppointment } from "./mock-data";
import { LOCATION_COLOR_HEX } from "./location-colors";
import { addDentist, updateDentistColor } from "./dentist-store";
import "./agenda.css";

type ViewKey = "timeGridDay" | "timeGridWeek" | "dayGridMonth";
const VIEW_LABEL: Record<ViewKey, string> = {
  timeGridDay: "Dia",
  timeGridWeek: "Semana",
  dayGridMonth: "Mês",
};

interface ModalState {
  editingAppointment: MockAppointment | null;
  initialDate: Date;
  initialStart?: Date;
  initialEnd?: Date;
}

export function AgendaPage() {
  const { user } = useAuth();
  const mock = useAgendaMockData(user);
  const calendarRef = useRef<FullCalendar>(null);

  const [appointments, setAppointments] = useState<MockAppointment[]>([]);
  useEffect(() => {
    if (!mock.isLoading) setAppointments(mock.appointments);
  }, [mock.isLoading, mock.appointments]);

  const [hiddenLocationIds, setHiddenLocationIds] = useState<Set<string>>(new Set());
  const [hiddenDentistIds, setHiddenDentistIds] = useState<Set<string>>(new Set());
  const [view, setView] = useState<ViewKey>("timeGridWeek");
  const [viewDropdownOpen, setViewDropdownOpen] = useState(false);
  const [rangeLabel, setRangeLabel] = useState("");
  const [modalState, setModalState] = useState<ModalState | null>(null);
  const [detailAppointment, setDetailAppointment] = useState<MockAppointment | null>(null);

  // Admin/recepcionista enxergam e agrupam por dentista (multi-dentista);
  // dentista logado continua vendo a agenda por consultório, sem alterar
  // o comportamento que já existia (modo freelancer). mock.dentists já
  // vem vazio para role DENTIST — ver useAgendaMockData.
  const viewByDentist = mock.dentists.length > 0;

  const locationById = useMemo(() => new Map(mock.locations.map((l) => [l.id, l])), [mock.locations]);
  const dentistById = useMemo(() => new Map(mock.dentists.map((d) => [d.id, d])), [mock.dentists]);

  const events = useMemo(
    () =>
      appointments
        .filter((appt) => !hiddenLocationIds.has(appt.locationId))
        .filter((appt) => !viewByDentist || !hiddenDentistIds.has(appt.dentistUserId))
        .map((appt) => {
          const color = viewByDentist
            ? LOCATION_COLOR_HEX[dentistById.get(appt.dentistUserId)?.colorToken ?? "brand"]
            : LOCATION_COLOR_HEX[locationById.get(appt.locationId)?.colorToken ?? "brand"];
          return {
            id: appt.id,
            start: appt.start,
            end: appt.end,
            backgroundColor: color.light,
            borderColor: color.solid,
            extendedProps: { appointment: appt },
          };
        }),
    [appointments, hiddenLocationIds, hiddenDentistIds, viewByDentist, locationById, dentistById],
  );

  function changeView(next: ViewKey) {
    setView(next);
    setViewDropdownOpen(false);
    calendarRef.current?.getApi().changeView(next);
  }

  function handleSelect(arg: DateSelectArg) {
    setModalState({ editingAppointment: null, initialDate: arg.start, initialStart: arg.start, initialEnd: arg.end });
    calendarRef.current?.getApi().unselect();
  }

  function handleEventClick(arg: EventClickArg) {
    const appt = arg.event.extendedProps.appointment as MockAppointment;
    setDetailAppointment(appt);
  }

  function handleSaveAppointment(appointment: MockAppointment) {
    setAppointments((prev) => {
      const exists = prev.some((a) => a.id === appointment.id);
      return exists ? prev.map((a) => (a.id === appointment.id ? appointment : a)) : [...prev, appointment];
    });
    setModalState(null);
  }

  function handleChangeStatus(status: AppointmentStatus) {
    if (!detailAppointment) return;
    setAppointments((prev) => prev.map((a) => (a.id === detailAppointment.id ? { ...a, status } : a)));
    setDetailAppointment((prev) => (prev ? { ...prev, status } : prev));
  }

  function toggleLocation(locationId: string) {
    setHiddenLocationIds((prev) => {
      const next = new Set(prev);
      if (next.has(locationId)) next.delete(locationId);
      else next.add(locationId);
      return next;
    });
  }

  function toggleDentist(dentistId: string) {
    setHiddenDentistIds((prev) => {
      const next = new Set(prev);
      if (next.has(dentistId)) next.delete(dentistId);
      else next.add(dentistId);
      return next;
    });
  }

  function handleAddDentist(input: { name: string; croUf: string; email: string }) {
    addDentist(input);
    mock.refreshDentists();
  }

  function handleChangeDentistColor(dentistId: string, colorToken: Parameters<typeof updateDentistColor>[1]) {
    updateDentistColor(dentistId, colorToken);
    mock.refreshDentists();
  }

  return (
    <div className="space-y-4">
      <PageHeader breadcrumb="Início / Agenda" title="Agenda" />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <button
              onClick={() => calendarRef.current?.getApi().prev()}
              className="rounded-lg border border-line px-3 py-1.5 text-sm text-ink hover:bg-gray-100"
            >
              ‹
            </button>
            <button
              onClick={() => calendarRef.current?.getApi().next()}
              className="rounded-lg border border-line px-3 py-1.5 text-sm text-ink hover:bg-gray-100"
            >
              ›
            </button>
            <button
              onClick={() => calendarRef.current?.getApi().today()}
              className="rounded-lg border border-line px-3 py-1.5 text-sm text-ink hover:bg-gray-100"
            >
              Hoje
            </button>
          </div>
          <span className="text-sm font-medium text-ink">{rangeLabel}</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <button
              onClick={() => setViewDropdownOpen((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm text-ink hover:bg-gray-100"
            >
              {VIEW_LABEL[view]}
              <ChevronDown className="h-4 w-4" />
            </button>
            {viewDropdownOpen && (
              <div className="absolute right-0 z-10 mt-1 w-32 rounded-lg border border-line bg-surface py-1 shadow-lg">
                {(Object.keys(VIEW_LABEL) as ViewKey[]).map((key) => (
                  <button
                    key={key}
                    onClick={() => changeView(key)}
                    className="block w-full px-3 py-1.5 text-left text-sm text-ink hover:bg-gray-100"
                  >
                    {VIEW_LABEL[key]}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => {
              const start = new Date();
              start.setMinutes(0, 0, 0);
              const end = new Date(start.getTime() + 30 * 60_000);
              setModalState({ editingAppointment: null, initialDate: start, initialStart: start, initialEnd: end });
            }}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white"
          >
            <Plus className="h-4 w-4" />
            Novo agendamento
          </button>
        </div>
      </div>

      <div className="flex gap-4">
        {viewByDentist ? (
          <DentistSidebar
            dentists={mock.dentists}
            hiddenDentistIds={hiddenDentistIds}
            onToggle={toggleDentist}
            onAddDentist={handleAddDentist}
            onChangeColor={handleChangeDentistColor}
          />
        ) : (
          <CalendarSidebar locations={mock.locations} hiddenLocationIds={hiddenLocationIds} onToggle={toggleLocation} />
        )}

        <div className="agenda-calendar min-w-0 flex-1 rounded-2xl border border-line bg-surface p-3">
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView={view}
            headerToolbar={false}
            height="75vh"
            nowIndicator
            selectable
            selectMirror
            slotEventOverlap={!viewByDentist}
            slotMinTime="07:00:00"
            slotMaxTime="20:00:00"
            locale="pt-br"
            firstDay={1}
            events={events}
            select={handleSelect}
            eventClick={handleEventClick}
            datesSet={(arg: DatesSetArg) => setRangeLabel(arg.view.title)}
            eventContent={(arg: EventContentArg) => {
              const appt = arg.event.extendedProps.appointment as MockAppointment | undefined;
              // O preview de seleção (selectMirror, enquanto o usuário arrasta
              // pra criar um agendamento) dispara eventContent sem
              // extendedProps.appointment — não é um evento de verdade.
              if (!appt) return null;
              const color = viewByDentist
                ? LOCATION_COLOR_HEX[dentistById.get(appt.dentistUserId)?.colorToken ?? "brand"]
                : LOCATION_COLOR_HEX[locationById.get(appt.locationId)?.colorToken ?? "brand"];
              return (
                <div
                  className="flex h-full items-stretch gap-1.5 overflow-hidden rounded-lg px-1.5 py-1 text-xs"
                  style={{ backgroundColor: color.light }}
                >
                  <span className="w-1 shrink-0 rounded-full" style={{ backgroundColor: color.solid }} />
                  <div className="min-w-0 truncate text-ink">
                    <p className="truncate font-medium">{appt.patientName}</p>
                    <p className="truncate text-[11px] text-muted">{appt.procedureName}</p>
                  </div>
                </div>
              );
            }}
          />
        </div>
      </div>

      {modalState && (
        <AppointmentCreateModal
          locations={mock.locations}
          dentists={mock.dentists}
          initialDate={modalState.initialDate}
          initialStart={modalState.initialStart}
          initialEnd={modalState.initialEnd}
          editingAppointment={modalState.editingAppointment}
          onClose={() => setModalState(null)}
          onSave={handleSaveAppointment}
        />
      )}

      {detailAppointment && (
        <AppointmentDetailPanel
          appointment={detailAppointment}
          location={locationById.get(detailAppointment.locationId)}
          dentist={dentistById.get(detailAppointment.dentistUserId)}
          onClose={() => setDetailAppointment(null)}
          onReschedule={() => {
            setModalState({
              editingAppointment: detailAppointment,
              initialDate: detailAppointment.start,
              initialStart: detailAppointment.start,
              initialEnd: detailAppointment.end,
            });
            setDetailAppointment(null);
          }}
          onChangeStatus={handleChangeStatus}
        />
      )}
    </div>
  );
}
