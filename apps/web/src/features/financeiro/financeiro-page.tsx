import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/page-header";
import { myClinicApi } from "@/features/my-clinic/api";
import { AttendanceForm } from "./attendance-form";
import { FinancialReport } from "./financial-report";
import { ClinicTermsForm } from "./clinic-terms-form";

type Tab = "registrar" | "relatorio" | "termos";

export function FinanceiroPage() {
  const [tab, setTab] = useState<Tab>("registrar");
  const myClinicQuery = useQuery({ queryKey: ["my-clinic"], queryFn: myClinicApi.get });
  const isFreelancer = myClinicQuery.data?.type === "FREELANCER";

  function tabClass(t: Tab) {
    return `border-b-2 px-1 pb-2 text-sm ${tab === t ? "border-accent text-ink" : "border-transparent text-muted"}`;
  }

  return (
    <div className="space-y-6">
      <PageHeader breadcrumb="Início / Financeiro" title="Financeiro" />

      <div className="flex gap-4 border-b border-line">
        <button onClick={() => setTab("registrar")} className={tabClass("registrar")}>
          Registrar atendimento
        </button>
        <button onClick={() => setTab("relatorio")} className={tabClass("relatorio")}>
          Relatório consolidado
        </button>
        {isFreelancer && (
          <button onClick={() => setTab("termos")} className={tabClass("termos")}>
            Termos por consultório
          </button>
        )}
      </div>

      {tab === "registrar" && <AttendanceForm />}
      {tab === "relatorio" && <FinancialReport />}
      {tab === "termos" && isFreelancer && <ClinicTermsForm />}
    </div>
  );
}
