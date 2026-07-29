import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createAppointmentSchema,
  type AppointmentStatus,
  type CreateAppointmentInput,
} from "@dentist-system/shared-types";
import { appointmentsApi } from "./api";
import { patientsApi } from "@/features/patients/api";
import { clinicsApi } from "@/features/clinics/api";

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: "Agendado",
  DONE: "Realizado",
  CANCELED: "Cancelado",
  NO_SHOW: "Faltou",
};

function dayBounds(dateStr: string) {
  const from = new Date(`${dateStr}T00:00:00`);
  const to = new Date(`${dateStr}T23:59:59`);
  return { from: from.toISOString(), to: to.toISOString() };
}

export function AgendaPage() {
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();
  const { from, to } = dayBounds(selectedDate);

  const appointmentsQuery = useQuery({
    queryKey: ["appointments", selectedDate],
    queryFn: () => appointmentsApi.list(from, to),
  });
  const patientsQuery = useQuery({ queryKey: ["patients"], queryFn: patientsApi.list });
  const clinicsQuery = useQuery({ queryKey: ["clinics"], queryFn: clinicsApi.list });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateAppointmentInput>({ resolver: zodResolver(createAppointmentSchema) });

  const createMutation = useMutation({
    mutationFn: appointmentsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      reset();
      setShowForm(false);
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: AppointmentStatus }) =>
      appointmentsApi.update(id, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["appointments"] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-ink">Agenda</h1>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="rounded-md border border-line px-3 py-1.5 text-sm"
          />
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white"
        >
          {showForm ? "Cancelar" : "Novo agendamento"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit((data) => createMutation.mutate(data))}
          className="grid max-w-2xl gap-4 rounded-lg border border-line bg-surface p-6 sm:grid-cols-2"
        >
          <div>
            <label className="mb-1 block text-sm text-muted">Paciente</label>
            <select className="w-full rounded-md border border-line px-3 py-2 text-sm" {...register("patientId")}>
              <option value="">Selecione</option>
              {patientsQuery.data?.map((patient) => (
                <option key={patient.id} value={patient.id}>
                  {patient.name}
                </option>
              ))}
            </select>
            {errors.patientId && <p className="mt-1 text-sm text-bad">{errors.patientId.message}</p>}
          </div>
          <div>
            <label className="mb-1 block text-sm text-muted">Consultório</label>
            <select className="w-full rounded-md border border-line px-3 py-2 text-sm" {...register("clinicId")}>
              <option value="">Selecione</option>
              {clinicsQuery.data?.map((clinic) => (
                <option key={clinic.id} value={clinic.id}>
                  {clinic.name}
                </option>
              ))}
            </select>
            {errors.clinicId && <p className="mt-1 text-sm text-bad">{errors.clinicId.message}</p>}
          </div>
          <div>
            <label className="mb-1 block text-sm text-muted">Data e hora</label>
            <input
              type="datetime-local"
              className="w-full rounded-md border border-line px-3 py-2 text-sm"
              {...register("startsAt")}
            />
            {errors.startsAt && <p className="mt-1 text-sm text-bad">{errors.startsAt.message}</p>}
          </div>
          <div>
            <label className="mb-1 block text-sm text-muted">Notas</label>
            <input className="w-full rounded-md border border-line px-3 py-2 text-sm" {...register("notes")} />
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-60 sm:col-span-2"
          >
            Agendar
          </button>
        </form>
      )}

      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-muted">
            <tr>
              <th className="px-4 py-3">Horário</th>
              <th className="px-4 py-3">Paciente</th>
              <th className="px-4 py-3">Consultório</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {appointmentsQuery.data?.map((appt) => (
              <tr key={appt.id}>
                <td className="px-4 py-3">
                  {new Date(appt.startsAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </td>
                <td className="px-4 py-3">{appt.patient.name}</td>
                <td className="px-4 py-3">{appt.clinic.name}</td>
                <td className="px-4 py-3">
                  <select
                    value={appt.status}
                    onChange={(e) =>
                      statusMutation.mutate({ id: appt.id, status: e.target.value as AppointmentStatus })
                    }
                    className="rounded-md border border-line px-2 py-1 text-sm"
                  >
                    {Object.entries(STATUS_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {appointmentsQuery.data?.length === 0 && (
          <p className="p-4 text-sm text-muted">Nenhum agendamento neste dia.</p>
        )}
      </div>
    </div>
  );
}
