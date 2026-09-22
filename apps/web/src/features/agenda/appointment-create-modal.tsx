import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { patientsApi } from "@/features/patients/api";
import { proceduresApi } from "@/features/procedures/api";
import { LOCATION_COLOR_HEX } from "./location-colors";
import type { MockAppointment, MockDentist, MockLocation } from "./mock-data";

interface AppointmentCreateModalProps {
  locations: MockLocation[];
  dentists: MockDentist[];
  initialDate: Date;
  initialStart?: Date;
  initialEnd?: Date;
  editingAppointment?: MockAppointment | null;
  onClose: () => void;
  onSave: (appointment: MockAppointment) => void;
}

function toTimeInput(date: Date) {
  return date.toTimeString().slice(0, 5);
}

export function AppointmentCreateModal({
  locations,
  dentists,
  initialDate,
  initialStart,
  initialEnd,
  editingAppointment,
  onClose,
  onSave,
}: AppointmentCreateModalProps) {
  const isEditing = Boolean(editingAppointment);

  const patientsQuery = useQuery({ queryKey: ["patients"], queryFn: patientsApi.list });
  const proceduresQuery = useQuery({ queryKey: ["procedures"], queryFn: proceduresApi.list });

  const [patientSearch, setPatientSearch] = useState(editingAppointment?.patientName ?? "");
  const [selectedPatient, setSelectedPatient] = useState<{ name: string; phone: string } | null>(
    editingAppointment ? { name: editingAppointment.patientName, phone: editingAppointment.patientPhone } : null,
  );
  const [locationId, setLocationId] = useState(editingAppointment?.locationId ?? locations[0]?.id ?? "");
  const [dentistId, setDentistId] = useState(editingAppointment?.dentistUserId ?? dentists[0]?.id ?? "");
  const [procedureName, setProcedureName] = useState(editingAppointment?.procedureName ?? "");
  const [startTime, setStartTime] = useState(
    editingAppointment ? toTimeInput(editingAppointment.start) : initialStart ? toTimeInput(initialStart) : "09:00",
  );
  const [endTime, setEndTime] = useState(
    editingAppointment ? toTimeInput(editingAppointment.end) : initialEnd ? toTimeInput(initialEnd) : "09:30",
  );

  const filteredPatients = useMemo(() => {
    if (!patientSearch || selectedPatient) return [];
    const term = patientSearch.toLowerCase();
    return (patientsQuery.data ?? []).filter((p) => p.name.toLowerCase().includes(term)).slice(0, 6);
  }, [patientSearch, selectedPatient, patientsQuery.data]);

  function buildDateTime(baseDate: Date, time: string) {
    const parts = time.split(":");
    const hours = Number(parts[0]);
    const minutes = Number(parts[1]);
    const result = new Date(baseDate);
    result.setHours(hours, minutes, 0, 0);
    return result;
  }

  function handleSubmit() {
    if (!selectedPatient || !locationId || !procedureName) return;
    const baseDate = editingAppointment?.start ?? initialDate;
    const start = buildDateTime(baseDate, startTime);
    const end = buildDateTime(baseDate, endTime);

    onSave({
      id: editingAppointment?.id ?? `appt-manual-${Date.now()}`,
      calendarId: editingAppointment?.calendarId ?? `cal-${locationId}-manual-${dentistId || "self"}`,
      locationId,
      dentistUserId: dentistId || editingAppointment?.dentistUserId || "",
      patientName: selectedPatient.name,
      patientPhone: selectedPatient.phone,
      procedureName,
      start,
      end,
      status: editingAppointment?.status ?? "SCHEDULED",
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 p-4">
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6">
        <h2 className="mb-4 text-xl font-semibold text-ink">
          {isEditing ? "Remarcar agendamento" : "Novo agendamento"}
        </h2>

        <div className="space-y-4">
          <div className="relative">
            <label className="mb-1.5 block text-sm font-medium text-ink">Paciente</label>
            <input
              type="text"
              value={patientSearch}
              onChange={(e) => {
                setPatientSearch(e.target.value);
                setSelectedPatient(null);
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
                        setSelectedPatient({ name: patient.name, phone: patient.phone });
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
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!selectedPatient || !locationId || !procedureName}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {isEditing ? "Salvar alterações" : "Adicionar agendamento"}
          </button>
        </div>
      </div>
    </div>
  );
}
