import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import Chart from "react-apexcharts";
import type { OrganizationStatus } from "@dentist-system/shared-types";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { platformApi } from "./api";
import { CreateOrganizationForm } from "./create-organization-form";

const STATUS_TONE: Record<OrganizationStatus, BadgeTone> = {
  ACTIVE: "success",
  SUSPENDED: "warning",
  DELETED: "neutral",
};

const STATUS_LABEL: Record<OrganizationStatus, string> = {
  ACTIVE: "Ativa",
  SUSPENDED: "Suspensa",
  DELETED: "Excluída",
};

function formatMonthLabel(month: string) {
  const parts = month.split("-");
  const year = Number(parts[0]);
  const monthNumber = Number(parts[1]);
  return new Date(year, monthNumber - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
}

export function PlatformPage() {
  const [showForm, setShowForm] = useState(false);
  const organizationsQuery = useQuery({ queryKey: ["platform", "organizations"], queryFn: platformApi.listOrganizations });
  const statsQuery = useQuery({ queryKey: ["platform", "stats", "overview"], queryFn: platformApi.getOverviewStats });
  const stats = statsQuery.data;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted">Início / Plataforma</p>
        <div className="mt-1 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-ink">Visão Geral da Plataforma</h1>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white"
          >
            {showForm ? "Cancelar" : "Nova clínica"}
          </button>
        </div>
      </div>

      {showForm && <CreateOrganizationForm onDone={() => setShowForm(false)} />}

      {stats && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Organizações"
              value={stats.organizationsByStatus.total}
              breakdown={
                <>
                  <Badge tone="success">{stats.organizationsByStatus.ACTIVE} ativas</Badge>
                  <Badge tone="warning">{stats.organizationsByStatus.SUSPENDED} susp.</Badge>
                  <Badge tone="neutral">{stats.organizationsByStatus.DELETED} excl.</Badge>
                </>
              }
            />
            <StatCard
              label="Usuários ativos"
              value={stats.usersByRole.total}
              breakdown={
                <>
                  <Badge tone="success">{stats.usersByRole.ADMIN} admin</Badge>
                  <Badge tone="warning">{stats.usersByRole.DENTIST} dentista</Badge>
                  <Badge tone="neutral">{stats.usersByRole.RECEPTIONIST} recep.</Badge>
                </>
              }
            />
            <StatCard
              label="Dentistas"
              value={stats.totalDentistsActive}
              secondary={`${stats.totalDentistsRegistered} cadastrados no total`}
            />
            <StatCard label="Atendimentos no mês" value={stats.attendancesThisMonth} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <h2 className="mb-4 font-medium text-ink">Novos tenants por mês</h2>
              <Chart
                type="bar"
                height={280}
                options={{
                  chart: { toolbar: { show: false } },
                  colors: ["#3563e9"],
                  plotOptions: { bar: { borderRadius: 4, columnWidth: "45%" } },
                  dataLabels: { enabled: false },
                  xaxis: { categories: stats.newTenantsByMonth.map((m) => formatMonthLabel(m.month)) },
                  grid: { borderColor: "#dee4ef" },
                }}
                series={[{ name: "Novos tenants", data: stats.newTenantsByMonth.map((m) => m.count) }]}
              />
            </Card>
            <Card>
              <h2 className="mb-4 font-medium text-ink">Organizações por status</h2>
              <Chart
                type="donut"
                height={280}
                options={{
                  labels: ["Ativas", "Suspensas", "Excluídas"],
                  colors: ["#227a52", "#f79009", "#5c6b85"],
                  legend: { position: "bottom" },
                  dataLabels: { enabled: false },
                }}
                series={[
                  stats.organizationsByStatus.ACTIVE,
                  stats.organizationsByStatus.SUSPENDED,
                  stats.organizationsByStatus.DELETED,
                ]}
              />
            </Card>
          </div>

          <Card>
            <h2 className="mb-4 font-medium text-ink">Top clínicas por atendimentos (mês atual)</h2>
            {stats.topOrganizationsByAttendance.length === 0 ? (
              <p className="text-sm text-muted">Nenhum atendimento registrado neste mês.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="border-b border-line text-muted">
                  <tr>
                    <th className="py-2 pr-4">#</th>
                    <th className="py-2 pr-4">Clínica</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Atendimentos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {stats.topOrganizationsByAttendance.map((row, index) => (
                    <tr key={row.organizationId}>
                      <td className="py-2 pr-4 text-muted">{index + 1}</td>
                      <td className="py-2 pr-4">
                        <Link to={`/platform/organizations/${row.organizationId}`} className="text-accent">
                          {row.name}
                        </Link>
                      </td>
                      <td className="py-2 pr-4">
                        <Badge tone={STATUS_TONE[row.status]}>{STATUS_LABEL[row.status]}</Badge>
                      </td>
                      <td className="py-2 pr-4">{row.attendanceCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </>
      )}

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-muted">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Criada em</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {organizationsQuery.data?.map((org) => (
              <tr key={org.id}>
                <td className="px-4 py-3">
                  <Link to={`/platform/organizations/${org.id}`} className="text-accent">
                    {org.name}
                  </Link>
                </td>
                <td className="px-4 py-3">{org.type}</td>
                <td className="px-4 py-3">
                  <Badge tone={STATUS_TONE[org.status]}>{STATUS_LABEL[org.status]}</Badge>
                </td>
                <td className="px-4 py-3">{new Date(org.createdAt).toLocaleDateString("pt-BR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {organizationsQuery.data?.length === 0 && (
          <p className="p-4 text-sm text-muted">Nenhuma clínica cadastrada ainda.</p>
        )}
      </Card>
    </div>
  );
}
