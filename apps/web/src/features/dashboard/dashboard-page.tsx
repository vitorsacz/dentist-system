import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";

interface AppointmentRow {
  id: string;
  startsAt: string;
  status: string;
  patient: { name: string };
  clinic: { name: string };
}

interface RecallRow {
  id: string;
  dueDate: string;
  reason: string | null;
  patient: { name: string };
}

function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { from: start.toISOString(), to: end.toISOString() };
}

export function DashboardPage() {
  const { user } = useAuth();
  const { from, to } = todayRange();

  const appointmentsQuery = useQuery({
    queryKey: ["appointments", "today"],
    queryFn: () => apiClient.get<AppointmentRow[]>(`/appointments?from=${from}&to=${to}`),
  });

  const recallsQuery = useQuery({
    queryKey: ["recalls", "pending"],
    queryFn: () => apiClient.get<RecallRow[]>("/recalls"),
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Olá, {user?.name}</h1>
        <p className="text-sm text-muted">Resumo do dia</p>
      </div>

      <section className="rounded-lg border border-line bg-surface p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-medium text-ink">Consultas de hoje</h2>
          <Link to="/agenda" className="text-sm text-accent">
            Ver agenda
          </Link>
        </div>
        {appointmentsQuery.isLoading && <p className="text-sm text-muted">Carregando…</p>}
        {appointmentsQuery.data?.length === 0 && (
          <p className="text-sm text-muted">Nenhuma consulta agendada para hoje.</p>
        )}
        <ul className="divide-y divide-line">
          {appointmentsQuery.data?.map((appt) => (
            <li key={appt.id} className="flex items-center justify-between py-2 text-sm">
              <span>
                {new Date(appt.startsAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} —{" "}
                {appt.patient.name}
              </span>
              <span className="text-muted">{appt.clinic.name}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border border-line bg-surface p-6">
        <h2 className="mb-4 font-medium text-ink">Retornos pendentes</h2>
        {recallsQuery.data?.length === 0 && <p className="text-sm text-muted">Nenhum retorno pendente.</p>}
        <ul className="divide-y divide-line">
          {recallsQuery.data?.map((recall) => (
            <li key={recall.id} className="flex items-center justify-between py-2 text-sm">
              <span>{recall.patient.name}</span>
              <span className="text-muted">
                {new Date(recall.dueDate).toLocaleDateString("pt-BR")} {recall.reason ? `— ${recall.reason}` : ""}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
