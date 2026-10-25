import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { patientsApi } from "@/features/patients/api";
import { proceduresApi } from "@/features/procedures/api";
import { ApiError } from "@/lib/api-client";
import { LOCATION_COLOR_HEX } from "./location-colors";
import type { ConflictInfo } from "./api";
import { appointmentsApi, type AppointmentListItem } from "./api";
import type { MockLocation, MockDentist } from "./mock-data";

interface AppointmentCreateModalProps {
  locations: MockLocation[];
  dentists: MockDentist[];
  initialDate: Date;
  initialStart?: Date;
  initialEnd?: Date;
  editingAppointment?: AppointmentListItem | null;
  actorRoles: string[];
  onClose: () => void;
  onSuccess: () => void;
}

function toTimeInput(date: Date) {
  return date.toTimeString().slice(0, 5);
}

function buildDateTime(baseDate: Date, time: string): Date {
  const parts = time.split(":");
  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);
  const result = new Date(baseDate);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

export function AppointmentCreateModal({
  locations,
  dentists,
  initialDate,
  initialStart,
  initialEnd,
  editingAppointment,
  actorRoles,
  onClose,
  onSuccess,
}: AppointmentCreateModalProps) {
  const isEditing = Boolean(editingAppointment);
  const queryClient = useQueryClient();

  const canAllowOverlap =
    actorRoles.includes("ADMIN") || actorRoles.includes("RECEPTIONIST");

  const patientsQuery = useQuery({
    queryKey: ["patients"],
    queryFn: () => patientsApi.list(),
  });
  const proceduresQuery = useQuery({
    queryKey: ["procedures"],
    queryFn: proceduresApi.list,
  });

  const [patientSearch, setPatientSearch] = useState(
    editingAppointment?.patient.name ?? "",
  );
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(
    editingAppointment?.patientId ?? null,
  );
  const [locationId, setLocationId] = useState(
    editingAppointment?.clinicId ?? locations[0]?.id ?? "",
  );
  const [dentistId, setDentistId] = useState(
    editingAppointment?.dentistUserId ?? dentists[0]?.id ?? "",
  );
  const [procedureName, setProcedureName] = useState(
    editingAppointment?.notes ?? "",
  );
  const editStart = editingAppointment ? new Date(editingAppointment.startsAt) : null;
  const editEnd = editingAppointment ? new Date(editingAppointment.endsAt) : null;
  const [startTime, setStartTime] = useState(
    editStart ? toTimeInput(editStart) : initialStart ? toTimeInput(initialStart) : "09:00",
  );
  const [endTime, setEndTime] = useState(
    editEnd ? toTimeInput(editEnd) : initialEnd ? toTimeInput(initialEnd) : "09:30",
  );

  const [conflicts, setConflicts] = useState<ConflictInfo[] | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // patientsApi.list() returns only active patients by default
  const filteredPatients = useMemo(() => {
    if (!patientSearch || selectedPatientId) return [];
    const term = patientSearch.toLowerCase();
    return (patientsQuery.data ?? []).filter((p) => p.name.toLowerCase().includes(term)).slice(0, 6);
  }, [patientSearch, selectedPatientId, patientsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: (body: Parameters<typeof appointmentsApi.create>[0]) =>
      isEditing && editingAppointment
        ? appointmentsApi.update(editingAppointment.id, body)
        : appointmentsApi.create(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      onSuccess();
    },
    onError: (err: unknown) => {
      setConflicts(null);
      if (err instanceof ApiError && err.status === 409) {
        const body = err.body as { code?: string; conflicts?: ConflictInfo[] };
        if (body.code === "SCHEDULE_CONFLICT" && body.conflicts) {
          setConflicts(body.conflicts);
          return;
        }
      }
      setSubmitError(err instanceof Error ? err.message : "Erro ao salvar agendamento");
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => appointmentsApi.cancel(editingAppointment!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      onSuccess();
    },
    onError: (err: unknown) => {
      setSubmitError(err instanceof Error ? err.message : "Erro ao cancelar agendamento");
    },
  });

  function buildBody(allowOverlap?: boolean) {
    const baseDate = editStart ?? initialDate;
    const startsAt = buildDateTime(baseDate, startTime).toISOString();
    const endsAt = buildDateTime(baseDate, endTime).toISOString();
    return {
      patientId: selectedPatientId!,
      clinicId: locationId,
      dentistUserId: dentistId,
      startsAt,
      endsAt,
      notes: procedureName || undefined,
      ...(allowOverlap ? { allowOverlap: true as const } : {}),
    };
  }

  function handleSubmit() {
    if (!selectedPatientId || !locationId) return;
    setConflicts(null);
    setSubmitError(null);
    saveMutation.mutate(buildBody());
  }

  function handleForceOverlap() {
    if (!selectedPatientId || !locationId) return;
    setConflicts(null);
    setSubmitError(null);
    saveMutation.mutate(buildBody(true));
  }

  const isLoading = saveMutation.isPending || cancelMutation.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 p-4">
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6">
        <h2 className="mb-4 text-xl font-semibold text-ink">
          {isEditing ? "Remarcar agendamento" : "Novo agendamento"}
        </h2>

        <div className="space-y-4">
          {/* Patient search */}
          <div className="relative">
            <label className="mb-1.5 block text-sm font-medium text-ink">Paciente</label>
            <input
              type="text"
              value={patientSearch}
              onChange={(e) => {
                setPatientSearch(e.target.value);
                setSelectedPatientId(null);
              }}
              placeholder="Buscar paciente..."
              className="w-full rounded-lg border border-line px-3 py-2 text-sm text-ink placeholder:text-muted"
            />
            {filteredPatients.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full rounded-lg border border-line bg-surface shadow-lg">
                {filteredPatients.map((patient) => (
                  <li key={patient.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPatientId(patient.id);
                        setPatientSearch(patient.name);
                      }}
                      className="block w-full px-3 py-2 text-left text-sm text-ink hover:bg-gray-100"
                    >
                      {patient.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Clinic */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink">Consultório</label>
            <div className="flex items-center gap-2">
              {locationId && (
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-sm"
                  style={{
                    backgroundColor:
                      LOCATION_COLOR_HEX[locations.find((l) => l.id === locationId)?.colorToken ?? "brand"].solid,
                  }}
                />
              )}
              <select
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                className="w-full rounded-lg border border-line px-3 py-2 text-sm text-ink"
              >
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Dentist */}
          {dentists.length > 0 && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink">Dentista</label>
              <div className="flex items-center gap-2">
                {dentistId && (
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-sm"
                    style={{
                      backgroundColor:
                        LOCATION_COLOR_HEX[dentists.find((d) => d.id === dentistId)?.colorToken ?? "brand"].solid,
                    }}
                  />
                )}
                <select
                  value={dentistId}
                  onChange={(e) => setDentistId(e.target.value)}
                  className="w-full rounded-lg border border-line px-3 py-2 text-sm text-ink"
                >
                  {dentists.map((dentist) => (
                    <option key={dentist.id} value={dentist.id}>
                      {dentist.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink">Início</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-lg border border-line px-3 py-2 text-sm text-ink"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink">Fim</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full rounded-lg border border-line px-3 py-2 text-sm text-ink"
              />
            </div>
          </div>

          {/* Procedure */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink">Procedimento</label>
            <select
              value={procedureName}
              onChange={(e) => setProcedureName(e.target.value)}
              className="w-full rounded-lg border border-line px-3 py-2 text-sm text-ink"
            >
              <option value="">Selecione</option>
              {proceduresQuery.data?.map((procedure) => (
                <option key={procedure.id} value={procedure.name}>
                  {procedure.name}
                </option>
              ))}
            </select>
          </div>

          {/* Conflict warning */}
          {conflicts !== null && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
              <p className="mb-2 text-sm font-medium text-amber-800">
                Conflito de horário com {conflicts.length}{" "}
                agendamento{conflicts.length > 1 ? "s" : ""}:
              </p>
              <ul className="mb-3 space-y-1">
                {conflicts.map((c) => (
                  <li key={c.id} className="text-xs text-amber-700">
                    {new Date(c.startsAt).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {" – "}
                    {new Date(c.endsAt).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {c.patientName ? ` — ${c.patientName}` : ""}
                  </li>
                ))}
              </ul>
              {canAllowOverlap && (
                <button
                  type="button"
                  onClick={handleForceOverlap}
                  disabled={isLoading}
                  className="w-full rounded-lg border border-amber-400 bg-amber-100 px-3 py-1.5 text-sm font-medium text-amber-900 hover:bg-amber-200 disabled:opacity-60"
                >
                  Agendar mesmo assim
                </button>
              )}
            </div>
          )}

          {/* Generic error */}
          {submitError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{submitError}</p>
          )}
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          {isEditing && editingAppointment && (
            <button
              type="button"
              onClick={() => cancelMutation.mutate()}
              disabled={isLoading}
              className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 disabled:opacity-60"
            >
              Cancelar agendamento
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink disabled:opacity-60"
          >
            Fechar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!selectedPatientId || !locationId || isLoading}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {isLoading
              ? "Salvando…"
              : isEditing
                ? "Salvar alterações"
                : "Adicionar agendamento"}
          </button>
        </div>
      </div>
    </div>
  );
}
