import { useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";
import { AnamnesisTab } from "./tabs/anamnesis-tab";
import { ClinicalRecordsTab } from "./tabs/clinical-records-tab";
import { OdontogramTab } from "./tabs/odontogram-tab";
import { BudgetsTab } from "./tabs/budgets-tab";
import { useQuery } from "@tanstack/react-query";
import { patientsApi } from "./api";

type TabKey = "anamnesis" | "clinical-records" | "odontogram" | "budgets";

export function PatientDetailPage() {
  const { patientId = "" } = useParams();
  const { user } = useAuth();
  const isDentist = user?.role === "DENTIST";
  const [tab, setTab] = useState<TabKey>(isDentist ? "anamnesis" : "budgets");

  const patientQuery = useQuery({
    queryKey: ["patients", patientId],
    queryFn: () => patientsApi.findOne(patientId),
  });

  const tabs: { key: TabKey; label: string }[] = [
    ...(isDentist
      ? ([
          { key: "anamnesis", label: "Anamnese" },
          { key: "clinical-records", label: "Prontuário" },
          { key: "odontogram", label: "Odontograma" },
        ] as const)
      : []),
    { key: "budgets", label: "Orçamentos" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">{patientQuery.data?.name}</h1>
        <p className="text-sm text-muted">{patientQuery.data?.phone}</p>
      </div>

      <div className="flex gap-4 border-b border-line">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`border-b-2 px-1 pb-2 text-sm ${
              tab === t.key ? "border-accent text-ink" : "border-transparent text-muted"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "anamnesis" && isDentist && <AnamnesisTab patientId={patientId} />}
      {tab === "clinical-records" && isDentist && <ClinicalRecordsTab patientId={patientId} />}
      {tab === "odontogram" && isDentist && <OdontogramTab patientId={patientId} />}
      {tab === "budgets" && <BudgetsTab patientId={patientId} />}
    </div>
  );
}
