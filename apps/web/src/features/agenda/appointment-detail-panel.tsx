import { X } from "lucide-react";
import type { AppointmentStatus } from "@dentist-system/shared-types";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { LOCATION_COLOR_HEX } from "./location-colors";
import type { MockDentist } from "./dentist-store";
import type { MockAppointment, MockLocation } from "./mock-data";

const STATUS_LABEL: Record<AppointmentStatus, string> = {
  SCHEDULED: "Agendado",
  DONE: "Realizado",
  CANCELED: "Cancelado",
  NO_SHOW: "Faltou",
};

const STATUS_TONE: Record<AppointmentStatus, BadgeTone> = {
  SCHEDULED: "warning",
  DONE: "success",
  CANCELED: "error",
  NO_SHOW: "neutral",
};

interface AppointmentDetailPanelProps {
  appointment: MockAppointment;
  location: MockLocation | undefined;
  dentist?: MockDentist;
  onClose: () => void;
  onReschedule: () => void;
  onChangeStatus: (status: AppointmentStatus) => void;
}

function formatRange(start: Date, end: Date) {
  const dateLabel = start.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });
  const timeLabel = (d: Date) => d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${dateLabel} · ${timeLabel(start)} – ${timeLabel(end)}`;
}

export function AppointmentDetailPanel({
  appointment,
  location,
  dentist,
  onClose,
  onReschedule,
  onChangeStatus,
}: AppointmentDetailPanelProps) {
  const color = location ? LOCATION_COLOR_HEX[location.colorToken] : undefined;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-gray-900/20">
      <div className="h-full w-full max-w-sm overflow-y-auto border-l border-line bg-surface p-6">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <p className="text-sm text-muted">Agendamento</p>
            <h2 className="text-xl font-semibold text-ink">{appointment.patientName}</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-gray-100 hover:text-ink">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 text-sm">
          <div>
            <p className="text-muted">Telefone</p>
            <p className="text-ink">{appointment.patientPhone}</p>
          </div>
          <div>
            <p className="text-muted">Procedimento</p>
            <p className="text-ink">{appointment.procedureName}</p>
          </div>
          <div>
            <p className="text-muted">Horário</p>
            <p className="text-ink">{formatRange(appointment.start, appointment.end)}</p>
          </div>
          <div>
            <p className="text-muted">Consultório</p>
            <p className="flex items-center gap-2 text-ink">
              {color && <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color.solid }} />}
              {location?.name ?? "—"}
            </p>
          </div>
          {dentist && (
            <div>
              <p className="text-muted">Dentista</p>
              <p className="flex items-center gap-2 text-ink">
                <span
                  className="h-2.5 w-2.5 rounded-sm"
                  style={{ backgroundColor: LOCATION_COLOR_HEX[dentist.colorToken].solid }}
                />
                {dentist.name}
              </p>
            </div>
          )}
          <div>
            <p className="mb-1 text-muted">Status</p>
            <Badge tone={STATUS_TONE[appointment.status]}>{STATUS_LABEL[appointment.status]}</Badge>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-2">
          <button
            onClick={() => onChangeStatus("SCHEDULED")}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white"
          >
            Confirmar
          </button>
          <button
            onClick={onReschedule}
            className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink"
          >
            Remarcar
          </button>
          <button
            onClick={() => onChangeStatus("CANCELED")}
            className="rounded-lg border border-error-solid/30 px-4 py-2 text-sm font-medium text-bad"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
