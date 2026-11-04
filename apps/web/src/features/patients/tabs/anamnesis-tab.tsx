import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, useWatch, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { upsertAnamnesisSchema, type UpsertAnamnesisInput } from "@dentist-system/shared-types";
import { QueryStateWrapper } from "@/lib/use-query-state";
import { patientsApi, type Anamnesis } from "../api";

const TEXT_FIELDS: { name: keyof Omit<UpsertAnamnesisInput, "structured">; label: string }[] = [
  { name: "chiefComplaint", label: "Queixa principal" },
  { name: "allergies", label: "Alergias (texto livre)" },
  { name: "medications", label: "Medicações em uso" },
  { name: "healthConditions", label: "Condições de saúde" },
  { name: "dentalHistory", label: "Histórico odontológico" },
];

type AnswerKey = NonNullable<
  NonNullable<UpsertAnamnesisInput["structured"]>["answers"]
> extends Partial<infer R>
  ? keyof R
  : never;

interface QuestionDef {
  key: AnswerKey;
  label: string;
  requireDetail?: boolean;
}

const QUESTIONS: QuestionDef[] = [
  { key: "hypertension", label: "Hipertensão arterial?" },
  { key: "diabetes", label: "Diabetes?" },
  { key: "heartDisease", label: "Cardiopatia / doença cardíaca?", requireDetail: true },
  { key: "anticoagulant", label: "Uso de anticoagulante (AAS, Warfarina, etc.)?", requireDetail: true },
  { key: "pregnantOrBreastfeeding", label: "Gestante ou lactante?" },
  { key: "smoker", label: "Fumante?" },
  { key: "allergyAnesthetic", label: "Alergia a anestésico local?", requireDetail: true },
  { key: "allergyPenicillin", label: "Alergia a penicilina / antibiótico?", requireDetail: true },
  { key: "allergyLatex", label: "Alergia a látex?", requireDetail: true },
  { key: "previousSurgeries", label: "Cirurgias anteriores?" },
  { key: "bleedingProblems", label: "Problemas de sangramento / coagulação?", requireDetail: true },
  { key: "bisphosphonate", label: "Uso de bisfosfonato (Alendronato, Zoledronato, etc.)?", requireDetail: true },
  { key: "asthma", label: "Asma / doença respiratória?" },
  { key: "epilepsy", label: "Epilepsia / convulsão?" },
  { key: "kidneyLiverDisease", label: "Doença renal ou hepática?" },
  { key: "underMedicalTreatment", label: "Em tratamento médico atual?" },
  { key: "otherConditions", label: "Outras condições de saúde relevantes?" },
];

function QuestionRow({
  q,
  control,
  readOnly,
}: {
  q: QuestionDef;
  control: ReturnType<typeof useForm<UpsertAnamnesisInput>>["control"];
  readOnly?: boolean;
}) {
  const value = useWatch({ control, name: `structured.answers.${q.key}.value` });
  return (
    <div className="border-b border-line py-3 last:border-b-0">
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm">{q.label}</span>
        <div className="flex gap-3 text-sm">
          {(["true", "false", "null"] as const).map((opt) => {
            const optVal = opt === "null" ? null : opt === "true";
            const label = opt === "null" ? "—" : opt === "true" ? "Sim" : "Não";
            return (
              <Controller
                key={opt}
                control={control}
                name={`structured.answers.${q.key}.value`}
                render={({ field }) => (
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      disabled={readOnly}
                      checked={
                        opt === "null"
                          ? field.value === null || field.value === undefined
                          : field.value === optVal
                      }
                      onChange={() => field.onChange(optVal)}
                      className="accent-accent"
                    />
                    <span className={opt === "null" ? "text-muted" : ""}>{label}</span>
                  </label>
                )}
              />
            );
          })}
        </div>
      </div>
      {value === true && (
        <Controller
          control={control}
          name={`structured.answers.${q.key}.detail`}
          render={({ field, fieldState }) => (
            <div className="mt-2">
              <input
                type="text"
                disabled={readOnly}
                placeholder={q.requireDetail ? "Detalhe (obrigatório)" : "Detalhe (opcional)"}
                className={`w-full rounded-md border px-3 py-1.5 text-sm disabled:bg-surface disabled:text-muted ${
                  fieldState.error ? "border-red-500" : "border-line"
                }`}
                value={field.value ?? ""}
                onChange={field.onChange}
                onBlur={field.onBlur}
              />
              {fieldState.error && (
                <p className="mt-0.5 text-xs text-red-500">{fieldState.error.message}</p>
              )}
            </div>
          )}
        />
      )}
    </div>
  );
}

function buildDefaultStructured(anamnesis: Anamnesis): UpsertAnamnesisInput["structured"] {
  if (!anamnesis.structured) {
    return { version: 1, answers: {} };
  }
  return anamnesis.structured as UpsertAnamnesisInput["structured"];
}

function AnamnesisForm({
  patientId,
  readOnly,
  anamnesis,
}: {
  patientId: string;
  readOnly?: boolean;
  anamnesis: Anamnesis;
}) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, control, formState } = useForm<UpsertAnamnesisInput>({
    resolver: zodResolver(upsertAnamnesisSchema),
    defaultValues: {
      chiefComplaint: anamnesis.chiefComplaint ?? "",
      allergies: anamnesis.allergies ?? "",
      medications: anamnesis.medications ?? "",
      healthConditions: anamnesis.healthConditions ?? "",
      dentalHistory: anamnesis.dentalHistory ?? "",
      structured: buildDefaultStructured(anamnesis),
    },
  });

  useEffect(() => {
    reset({
      chiefComplaint: anamnesis.chiefComplaint ?? "",
      allergies: anamnesis.allergies ?? "",
      medications: anamnesis.medications ?? "",
      healthConditions: anamnesis.healthConditions ?? "",
      dentalHistory: anamnesis.dentalHistory ?? "",
      structured: buildDefaultStructured(anamnesis),
    });
  }, [anamnesis, reset]);

  const mutation = useMutation({
    mutationFn: (data: UpsertAnamnesisInput) => patientsApi.upsertAnamnesis(patientId, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["patients", patientId, "anamnesis"] }),
  });

  return (
    <form
      onSubmit={handleSubmit((data) => mutation.mutate(data))}
      className="max-w-2xl space-y-6"
    >
      <div className="rounded-lg border border-line bg-surface p-6">
        <h3 className="mb-4 text-sm font-medium">Histórico de saúde</h3>
        {QUESTIONS.map((q) => (
          <QuestionRow key={q.key} q={q} control={control} readOnly={readOnly} />
        ))}
      </div>

      <div className="rounded-lg border border-line bg-surface p-6 space-y-4">
        <h3 className="text-sm font-medium">Observações gerais</h3>
        {TEXT_FIELDS.map((field) => (
          <div key={field.name}>
            <label className="mb-1 block text-sm text-muted">{field.label}</label>
            <textarea
              className="w-full rounded-md border border-line px-3 py-2 text-sm disabled:bg-surface disabled:text-muted"
              rows={field.name === "chiefComplaint" ? 2 : 3}
              disabled={readOnly}
              {...register(field.name)}
            />
          </div>
        ))}
      </div>

      {!readOnly && (
        <button
          type="submit"
          disabled={formState.isSubmitting}
          className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {mutation.isSuccess ? "Salvo ✓" : "Salvar anamnese"}
        </button>
      )}
    </form>
  );
}

export function AnamnesisTab({ patientId, readOnly }: { patientId: string; readOnly?: boolean }) {
  const anamnesisQuery = useQuery({
    queryKey: ["patients", patientId, "anamnesis"],
    queryFn: () => patientsApi.getAnamnesis(patientId),
  });

  return (
    <QueryStateWrapper query={anamnesisQuery}>
      {(data) => <AnamnesisForm patientId={patientId} readOnly={readOnly} anamnesis={data} />}
    </QueryStateWrapper>
  );
}
