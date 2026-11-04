import { Link } from "react-router-dom";
import { CalendarCheck, CalendarDays, DollarSign, Users } from "lucide-react";
import type { AppointmentStatus } from "@dentist-system/shared-types";
import { useAuth } from "@/lib/auth-context";
import { can } from "@/lib/access";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { AlertBanner } from "@/components/ui/alert-banner";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui/page-header";
import { useDashboardOverview } from "./api";

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

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function DashboardPage() {
  const { user } = useAuth();
  const { data, isLoading } = useDashboardOverview();

  const showRevenue = data?.revenueThisMonth !== undefined;
  const statCount = showRevenue ? 4 : 3;

  return (
    <div className="space-y-6">
      <PageHeader breadcrumb="Início" title={`Olá, ${user?.name ?? ""}`} />

      {can(user, "users.manage") && (
        <AlertBanner>
          Alguns dados da sua clínica ainda estão incompletos.{" "}
          <Link to="/my-clinic" className="font-medium underline">
            Completar cadastro
          </Link>
        </AlertBanner>
      )}

      <div className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-${statCount}`}>
        {isLoading ? (
          Array.from({ length: statCount }).map((_, i) => <Skeleton key={i} className="h-32" />)
        ) : (
          <>
            <StatCard
              label="Atendimentos no mês"
              value={data?.attendancesThisMonth}
              icon={<CalendarCheck className="h-5 w-5" />}
            />
            <StatCard
              label="Consultas esta semana"
              value={data?.appointmentsThisWeek}
              icon={<CalendarDays className="h-5 w-5" />}
            />
            <StatCard
              label="Pacientes ativos"
              value={data?.activePatients}
              icon={<Users className="h-5 w-5" />}
            />
            {showRevenue && (
              <StatCard
                label="Faturamento do mês"
                value={formatCurrency(data?.revenueThisMonth ?? 0)}
                icon={<DollarSign className="h-5 w-5" />}
              />
            )}
          </>
        )}
      </div>

      {data?.revenueByClinic && data.revenueByClinic.length > 0 && (
        <Card>
          <h2 className="mb-4 font-medium text-ink">Faturamento por clínica</h2>
          <ul className="divide-y divide-line">
            {data.revenueByClinic.map((c) => (
              <li key={c.clinicId} className="flex items-center justify-between py-2.5 text-sm">
                <span className="text-ink">{c.clinicName}</span>
                <span className="font-medium text-ink">{formatCurrency(c.revenue)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-medium text-ink">Hoje</h2>
          <Link to="/agenda" className="text-sm text-accent">
            Ver agenda completa
          </Link>
        </div>
        {isLoading ? (
          <Skeleton className="h-64" />
        ) : !data || data.appointmentsToday.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-sm text-muted">Nenhum atendimento hoje.</p>
            <Link to="/agenda" className="text-sm font-medium text-accent">
              Ver agenda completa
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {data.appointmentsToday.slice(0, 4).map((appt) => (
              <li key={appt.id} className="flex items-center justify-between py-2.5 text-sm">
                <div>
                  <span className="font-medium text-ink">{appt.time}</span> — {appt.patientName}
                  <p className="text-xs text-muted">{appt.clinicName}</p>
                </div>
                <Badge tone={STATUS_TONE[appt.status]}>{STATUS_LABEL[appt.status]}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
