import { useQuery } from "@tanstack/react-query";
import { patientsApi, type StructuredAnamnesisAnswers } from "./api";

const ALERT_LABELS: Record<keyof StructuredAnamnesisAnswers, string> = {
  hypertension: "Hipertensão",
  diabetes: "Diabetes",
  heartDisease: "Cardiopatia",
  anticoagulant: "Anticoagulante",
  pregnantOrBreastfeeding: "Gestante/lactante",
  smoker: "Fumante",
  allergyAnesthetic: "Alergia a anestésico",
  allergyPenicillin: "Alergia a penicilina",
  allergyLatex: "Alergia a látex",
  previousSurgeries: "Cirurgias anteriores",
  bleedingProblems: "Sangramento",
  bisphosphonate: "Bisfosfonato",
  asthma: "Asma/respiratório",
  epilepsy: "Epilepsia",
  kidneyLiverDisease: "Doença renal/hepática",
  underMedicalTreatment: "Tratamento médico",
  otherConditions: "Outras condições",
};

function deriveAlerts(answers: StructuredAnamnesisAnswers): { key: string; label: string; detail?: string | null }[] {
  return (Object.keys(ALERT_LABELS) as (keyof StructuredAnamnesisAnswers)[])
    .filter((k) => answers[k]?.value === true)
    .map((k) => ({ key: k, label: ALERT_LABELS[k], detail: answers[k]?.detail }));
}

export function HealthAlertsBar({ patientId }: { patientId: string }) {
  const { data } = useQuery({
    queryKey: ["patients", patientId, "anamnesis"],
    queryFn: () => patientsApi.getAnamnesis(patientId),
  });

  if (!data?.structured?.answers) return null;
  const alerts = deriveAlerts(data.structured.answers);
  if (alerts.length === 0) return null;

  return (
    <div className="rounded-lg border border-warn/40 bg-warn/5 px-4 py-3">
      <p className="mb-2 text-xs font-medium text-warn">Alertas de saúde</p>
      <div className="flex flex-wrap gap-2">
        {alerts.map((a) => (
          <span
            key={a.key}
            title={a.detail ?? undefined}
            className="rounded-full bg-warn/10 px-2.5 py-0.5 text-xs font-medium text-warn"
          >
            {a.label}
            {a.detail ? ` — ${a.detail}` : ""}
          </span>
        ))}
      </div>
    </div>
  );
}
