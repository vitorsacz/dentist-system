import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import ReactApexChart from "react-apexcharts";
import { can } from "@/lib/access";
import { useAuth } from "@/lib/auth-context";
import { myClinicApi } from "@/features/my-clinic/api";
import { reportsApi } from "./api";

function firstDayOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function money(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function shortMoney(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

export function FinancialReport() {
  const { user } = useAuth();
  const isAdmin = can(user, "organization.dentists");
  const [from, setFrom] = useState(firstDayOfMonth());
  const [to, setTo] = useState(today());
  const [dentistUserId, setDentistUserId] = useState<string>("");
  const [downloading, setDownloading] = useState(false);

  const dentistsQuery = useQuery({
    queryKey: ["organization", "dentists"],
    queryFn: () => myClinicApi.dentists(),
    enabled: isAdmin,
  });

  const reportQuery = useQuery({
    queryKey: ["reports", "financial", from, to, dentistUserId],
    queryFn: () =>
      reportsApi.financial(
        `${from}T00:00:00`,
        `${to}T23:59:59`,
        undefined,
        dentistUserId || undefined,
      ),
  });

  async function handleCsvDownload() {
    setDownloading(true);
    try {
      const blob = await reportsApi.csvDownload(`${from}T00:00:00`, `${to}T23:59:59`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `relatorio-financeiro-${from}-${to}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  const data = reportQuery.data;
  const hasMultipleMonths = (data?.monthly.length ?? 0) > 1;
  const hasAnyClinics = (data?.clinics.length ?? 0) > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-sm text-muted">De</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-md border border-line px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-muted">Até</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-md border border-line px-3 py-2 text-sm"
          />
        </div>
        {isAdmin && (
          <div>
            <label className="mb-1 block text-sm text-muted">Dentista</label>
            <select
              value={dentistUserId}
              onChange={(e) => setDentistUserId(e.target.value)}
              className="rounded-md border border-line px-3 py-2 text-sm"
            >
              <option value="">Todos</option>
              {dentistsQuery.data?.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <button
          onClick={handleCsvDownload}
          disabled={downloading}
          className="rounded-md border border-line px-4 py-2 text-sm hover:bg-surface disabled:opacity-50"
        >
          {downloading ? "Exportando…" : "Exportar CSV"}
        </button>
      </div>

      {data && hasAnyClinics && (
        <div className="grid gap-4 md:grid-cols-2">
          {hasMultipleMonths && (
            <div className="rounded-lg border border-line bg-surface p-4 md:col-span-2">
              <p className="mb-2 text-sm font-medium text-muted">Receita por mês</p>
              <ReactApexChart
                type="bar"
                height={220}
                series={[
                  { name: "Faturamento bruto", data: data.monthly.map((m) => m.grossRevenue) },
                  { name: "Repasse dentista", data: data.monthly.map((m) => m.dentistRepasse) },
                ]}
                options={{
                  chart: { toolbar: { show: false }, fontFamily: "inherit" },
                  xaxis: { categories: data.monthly.map((m) => m.month) },
                  yaxis: { labels: { formatter: (v) => shortMoney(v) } },
                  dataLabels: { enabled: false },
                  colors: ["#6366f1", "#22c55e"],
                  plotOptions: { bar: { borderRadius: 3, columnWidth: "55%" } },
                  tooltip: { y: { formatter: (v) => money(v) } },
                  legend: { position: "top" },
                }}
              />
            </div>
          )}

          <div className="rounded-lg border border-line bg-surface p-4">
            <p className="mb-2 text-sm font-medium text-muted">Faturamento por consultório</p>
            <ReactApexChart
              type="bar"
              height={Math.max(180, data.clinics.length * 40)}
              series={[{ name: "Faturamento bruto", data: data.clinics.map((c) => c.grossRevenue) }]}
              options={{
                chart: { toolbar: { show: false }, fontFamily: "inherit" },
                plotOptions: { bar: { horizontal: true, borderRadius: 3, barHeight: "55%" } },
                xaxis: {
                  categories: data.clinics.map((c) => c.clinicName),
                  labels: { formatter: (v) => shortMoney(Number(v)) },
                },
                yaxis: { labels: { maxWidth: 160 } },
                dataLabels: { enabled: false },
                colors: ["#6366f1"],
                tooltip: { y: { formatter: (v) => money(v) } },
              }}
            />
          </div>

          <div className="rounded-lg border border-line bg-surface p-4">
            <p className="mb-2 text-sm font-medium text-muted">Composição do resultado</p>
            <ReactApexChart
              type="donut"
              height={220}
              series={[
                data.totals.dentistRepasse,
                data.totals.materialCost,
                data.totals.rentCost,
              ]}
              options={{
                chart: { fontFamily: "inherit" },
                labels: ["Repasse dentista", "Custo material", "Custo aluguel"],
                colors: ["#22c55e", "#f59e0b", "#ef4444"],
                dataLabels: { enabled: false },
                legend: { position: "bottom" },
                tooltip: { y: { formatter: (v) => money(v) } },
                plotOptions: { pie: { donut: { size: "65%" } } },
              }}
            />
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-muted">
            <tr>
              <th className="px-4 py-3">Consultório</th>
              <th className="px-4 py-3">Faturamento bruto</th>
              <th className="px-4 py-3">Repasse dentista</th>
              <th className="px-4 py-3">Custo material</th>
              <th className="px-4 py-3">Custo aluguel</th>
              <th className="px-4 py-3">Resultado líquido</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {data?.clinics.map((row) => (
              <tr key={`${row.dentistUserId ?? ""}:${row.clinicId}`}>
                <td className="px-4 py-3">{row.clinicName}{row.dentistName ? ` — ${row.dentistName}` : ""}</td>
                <td className="px-4 py-3 tabular">{money(row.grossRevenue)}</td>
                <td className="px-4 py-3 tabular">{money(row.dentistRepasse)}</td>
                <td className="px-4 py-3 tabular">{money(row.materialCost)}</td>
                <td className="px-4 py-3 tabular">{money(row.rentCost)}</td>
                <td className="px-4 py-3 tabular font-medium">{money(row.netResult)}</td>
              </tr>
            ))}
          </tbody>
          {data && (
            <tfoot className="border-t border-line font-medium">
              <tr>
                <td className="px-4 py-3">Total</td>
                <td className="px-4 py-3 tabular">{money(data.totals.grossRevenue)}</td>
                <td className="px-4 py-3 tabular">{money(data.totals.dentistRepasse)}</td>
                <td className="px-4 py-3 tabular">{money(data.totals.materialCost)}</td>
                <td className="px-4 py-3 tabular">{money(data.totals.rentCost)}</td>
                <td className="px-4 py-3 tabular">{money(data.totals.netResult)}</td>
              </tr>
            </tfoot>
          )}
        </table>
        {data?.clinics.length === 0 && (
          <p className="p-4 text-sm text-muted">Nenhum atendimento no período selecionado.</p>
        )}
      </div>

      {data && data.clinicsWithoutTerms.length > 0 && (
        <div className="rounded-md border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
          <strong>Atenção:</strong> os seguintes consultórios não têm termos financeiros cadastrados — valores de aluguel podem estar incorretos:{" "}
          {data.clinicsWithoutTerms.join(", ")}. Acesse{" "}
          <strong>Termos por consultório</strong> para configurar.
        </div>
      )}
    </div>
  );
}
