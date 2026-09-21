import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { AttendanceForm } from "./attendance-form";
import { FinancialReport } from "./financial-report";

export function FinanceiroPage() {
  const [tab, setTab] = useState<"registrar" | "relatorio">("registrar");

  return (
    <div className="space-y-6">
      <PageHeader breadcrumb="Início / Financeiro" title="Financeiro" />

      <div className="flex gap-4 border-b border-line">
        <button
          onClick={() => setTab("registrar")}
          className={`border-b-2 px-1 pb-2 text-sm ${
            tab === "registrar" ? "border-accent text-ink" : "border-transparent text-muted"
          }`}
        >
          Registrar atendimento
        </button>
        <button
          onClick={() => setTab("relatorio")}
          className={`border-b-2 px-1 pb-2 text-sm ${
            tab === "relatorio" ? "border-accent text-ink" : "border-transparent text-muted"
          }`}
        >
          Relatório consolidado
        </button>
      </div>

      {tab === "registrar" ? <AttendanceForm /> : <FinancialReport />}
    </div>
  );
}
