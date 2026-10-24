import { useState } from "react";
import { useParams } from "react-router-dom";
import { can } from "@/lib/access";
import { useAuth } from "@/lib/auth-context";
import { AnamnesisTab } from "./tabs/anamnesis-tab";
import { ClinicalRecordsTab } from "./tabs/clinical-records-tab";
import { OdontogramTab } from "./tabs/odontogram-tab";
import { BudgetsTab } from "./tabs/budgets-tab";
import { useQuery } from "@tanstack/react-query";
import { isPatientComplete } from "@dentist-system/shared-types";
import { patientsApi } from "./api";

type TabKey = "anamnesis" | "clinical-records" | "odontogram" | "budgets" | "revisions";

const MARITAL_LABEL: Record<string, string> = {
  SOLTEIRO: "Solteiro(a)",
  CASADO: "Casado(a)",
  DIVORCIADO: "Divorciado(a)",
  VIUVO: "Viúvo(a)",
  UNIAO_ESTAVEL: "União estável",
};

export function PatientDetailPage() {
  const { patientId = "" } = useParams();
  const { user } = useAuth();
  const canSeeClinical = can(user, "clinical.read");
  const [tab, setTab] = useState<TabKey>(canSeeClinical ? "anamnesis" : "budgets");

  const patientQuery = useQuery({
    queryKey: ["patients", patientId],
    queryFn: () => patientsApi.findOne(patientId),
  });

  const revisionsQuery = useQuery({
    queryKey: ["patients", patientId, "revisions"],
    queryFn: () => patientsApi.getRevisions(patientId),
    enabled: tab === "revisions",
  });

  const patient = patientQuery.data;

  const tabs: { key: TabKey; label: string }[] = [
    ...(canSeeClinical
      ? ([
          { key: "anamnesis", label: "Anamnese" },
          { key: "clinical-records", label: "Prontuário" },
          { key: "odontogram", label: "Odontograma" },
        ] as const)
      : []),
    { key: "budgets", label: "Orçamentos" },
    { key: "revisions", label: "Histórico" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-ink">{patient?.name}</h1>
            {patient && !isPatientComplete(patient) && (
              <span className="rounded-full bg-warn/10 px-2 py-0.5 text-xs text-warn">
                Cadastro incompleto
              </span>
            )}
          </div>
          <p className="text-sm text-muted">{patient?.phone}</p>
          {patient?.ownerDentist && (
            <p className="mt-1 text-xs text-muted">Responsável: {patient.ownerDentist.name}</p>
          )}
        </div>
      </div>

      {patient && (
        <div className="grid gap-2 rounded-lg border border-line bg-surface p-4 text-sm sm:grid-cols-3">
          {patient.email && <div><span className="text-muted">E-mail: </span>{patient.email}</div>}
          {patient.cpf && <div><span className="text-muted">CPF: </span>{patient.cpf}</div>}
          {patient.sex && <div><span className="text-muted">Sexo: </span>{patient.sex === "F" ? "Feminino" : "Masculino"}</div>}
          {patient.maritalStatus && <div><span className="text-muted">Estado civil: </span>{MARITAL_LABEL[patient.maritalStatus] ?? patient.maritalStatus}</div>}
          {patient.profession && <div><span className="text-muted">Profissão: </span>{patient.profession}</div>}
          {patient.address && <div className="sm:col-span-2"><span className="text-muted">Endereço: </span>{patient.address}</div>}
          {patient.preferredDrink && <div><span className="text-muted">Bebida: </span>{patient.preferredDrink}</div>}
          {patient.preferredMusic && <div><span className="text-muted">Música: </span>{patient.preferredMusic}</div>}
        </div>
      )}

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

      {tab === "anamnesis" && canSeeClinical && <AnamnesisTab patientId={patientId} />}
      {tab === "clinical-records" && canSeeClinical && <ClinicalRecordsTab patientId={patientId} />}
      {tab === "odontogram" && canSeeClinical && <OdontogramTab patientId={patientId} />}
      {tab === "budgets" && <BudgetsTab patientId={patientId} />}
      {tab === "revisions" && (
        <div className="space-y-3">
          {revisionsQuery.data?.length === 0 && (
            <p className="text-sm text-muted">Nenhuma edição registrada.</p>
          )}
          {revisionsQuery.data?.map((rev) => (
            <div key={rev.id} className="rounded-lg border border-line bg-surface p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium">{rev.changedBy.name}</span>
                <span className="text-xs text-muted">{new Date(rev.changedAt).toLocaleString("pt-BR")}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
