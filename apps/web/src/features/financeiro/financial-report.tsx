import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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

export function FinancialReport() {
  const [from, setFrom] = useState(firstDayOfMonth());
  const [to, setTo] = useState(today());

  const reportQuery = useQuery({
    queryKey: ["reports", "financial", from, to],
    queryFn: () => reportsApi.financial(`${from}T00:00:00`, `${to}T23:59:59`),
  });

  return (
    <div className="space-y-4">
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
      </div>

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
            {reportQuery.data?.clinics.map((row) => (
              <tr key={row.clinicId}>
                <td className="px-4 py-3">{row.clinicName}</td>
                <td className="px-4 py-3 tabular">{money(row.grossRevenue)}</td>
                <td className="px-4 py-3 tabular">{money(row.dentistRepasse)}</td>
                <td className="px-4 py-3 tabular">{money(row.materialCost)}</td>
                <td className="px-4 py-3 tabular">{money(row.rentCost)}</td>
                <td className="px-4 py-3 tabular font-medium">{money(row.netResult)}</td>
              </tr>
            ))}
          </tbody>
          {reportQuery.data && (
            <tfoot className="border-t border-line font-medium">
              <tr>
                <td className="px-4 py-3">Total</td>
                <td className="px-4 py-3 tabular">{money(reportQuery.data.totals.grossRevenue)}</td>
                <td className="px-4 py-3 tabular">{money(reportQuery.data.totals.dentistRepasse)}</td>
                <td className="px-4 py-3 tabular">{money(reportQuery.data.totals.materialCost)}</td>
                <td className="px-4 py-3 tabular">{money(reportQuery.data.totals.rentCost)}</td>
                <td className="px-4 py-3 tabular">{money(reportQuery.data.totals.netResult)}</td>
              </tr>
            </tfoot>
          )}
        </table>
        {reportQuery.data?.clinics.length === 0 && (
          <p className="p-4 text-sm text-muted">Nenhum atendimento no período selecionado.</p>
        )}
      </div>
    </div>
  );
}
