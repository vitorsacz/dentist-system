import { Link } from "react-router-dom";
import Chart from "react-apexcharts";
import { CalendarCheck, DollarSign, Percent, Users } from "lucide-react";
import type { AppointmentStatus } from "@dentist-system/shared-types";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertBanner } from "@/components/ui/alert-banner";
import { PageHeader } from "@/components/ui/page-header";
import { useMockDashboardOverview } from "./mock-data";

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

const BUDGET_STATUS_LABEL: Record<string, string> = {
  PENDING: "Pendente",
  APPROVED: "Aprovado",
  IN_PROGRESS: "Em andamento",
  COMPLETED: "Concluído",
};

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function DashboardPage() {
  const { user } = useAuth();
  const { data, isLoading } = useMockDashboardOverview();
  const showRevenue = user?.role === "DENTIST";

  return (
    <div className="space-y-6">
      <PageHeader breadcrumb="Início" title={`Olá, ${user?.name ?? ""}`} />

      {isLoading && <Skeleton className="h-16 w-full" />}
        {!isLoading && data?.hasIncompleteProfile && (
          <AlertBanner>
            Alguns dados da sua clínica ainda estão incompletos.{" "}
            <Link to="/my-clinic" className="font-medium underline">
              Completar cadastro
            </Link>
          </AlertBanner>
        )}

        <div className={`grid gap-4 sm:grid-cols-2 ${showRevenue ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
          {isLoading ? (
            Array.from({ length: showRevenue ? 4 : 3 }).map((_, i) => <Skeleton key={i} className="h-32" />)
          ) : (
            <>
              <StatCard label="Dentistas ativos" value={data?.activeDentists} icon={<Users className="h-5 w-5" />} />
              <StatCard
                label="Pacientes atendidos no mês"
                value={data?.patientsAttendedThisMonth}
                icon={<CalendarCheck className="h-5 w-5" />}
              />
              {showRevenue && (
                <StatCard
                  label="Faturamento do mês"
                  value={formatCurrency(data?.revenueThisMonth ?? 0)}
                  icon={<DollarSign className="h-5 w-5" />}
                />
              )}
              <StatCard
                label="Ocupação da agenda"
                value={`${data?.agendaOccupancyPercent ?? 0}%`}
                icon={<Percent className="h-5 w-5" />}
              />
            </>
          )}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <h2 className="mb-4 font-medium text-ink">Receita por mês</h2>
            {isLoading || !data ? (
              <Skeleton className="h-64" />
            ) : (
              <Chart
                type="bar"
                height={260}
                options={{
                  chart: { toolbar: { show: false } },
                  colors: ["#465FFF"],
                  plotOptions: { bar: { borderRadius: 4, columnWidth: "45%" } },
                  dataLabels: { enabled: false },
                  xaxis: { categories: data.revenueByMonth.map((m) => m.month) },
                  yaxis: { labels: { formatter: (v: number) => formatCurrency(v) } },
                  grid: { borderColor: "#E4E7EC" },
                }}
                series={[{ name: "Receita", data: data.revenueByMonth.map((m) => m.revenue) }]}
              />
            )}
          </Card>

          <Card>
            <h2 className="mb-4 font-medium text-ink">Orçamentos por status</h2>
            {isLoading || !data ? (
              <Skeleton className="h-64" />
            ) : (
              <Chart
                type="donut"
                height={260}
                options={{
                  labels: data.budgetsByStatus.map((b) => BUDGET_STATUS_LABEL[b.status] ?? b.status),
                  colors: ["#F79009", "#0BA5EC", "#465FFF", "#12B76A"],
                  legend: { position: "bottom" },
                  dataLabels: { enabled: false },
                }}
                series={data.budgetsByStatus.map((b) => b.count)}
              />
            )}
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <h2 className="mb-4 font-medium text-ink">Meta de faturamento do mês</h2>
            {isLoading || !data ? (
              <Skeleton className="h-64" />
            ) : (
              <Chart
                type="radialBar"
                height={260}
                options={{
                  colors: ["#465FFF"],
                  plotOptions: {
                    radialBar: {
                      hollow: { size: "65%" },
                      dataLabels: {
                        name: { show: false },
                        value: { fontSize: "28px", fontWeight: 700, color: "#1D2939", formatter: (v: number) => `${v}%` },
                      },
                    },
                  },
                }}
                series={[data.monthlyGoalPercent]}
              />
            )}
          </Card>

          <Card>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-medium text-ink">Hoje</h2>
              <Link to="/agenda" className="text-sm text-accent">
                Ver agenda completa
              </Link>
            </div>
            {isLoading || !data ? (
              <Skeleton className="h-64" />
            ) : data.todayAppointments.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <p className="text-sm text-muted">Nenhum atendimento hoje.</p>
                <Link to="/agenda" className="text-sm font-medium text-accent">
                  Ver agenda completa
                </Link>
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {data.todayAppointments.slice(0, 4).map((appt) => (
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
    </div>
  );
}
