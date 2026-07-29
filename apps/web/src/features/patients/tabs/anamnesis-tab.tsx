import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { upsertAnamnesisSchema, type UpsertAnamnesisInput } from "@dentist-system/shared-types";
import { patientsApi } from "../api";

const FIELDS: { name: keyof UpsertAnamnesisInput; label: string }[] = [
  { name: "chiefComplaint", label: "Queixa principal" },
  { name: "allergies", label: "Alergias" },
  { name: "medications", label: "Medicações em uso" },
  { name: "healthConditions", label: "Condições de saúde (hipertensão, diabetes, gestação...)" },
  { name: "dentalHistory", label: "Histórico odontológico" },
];

export function AnamnesisTab({ patientId }: { patientId: string }) {
  const queryClient = useQueryClient();
  const anamnesisQuery = useQuery({
    queryKey: ["patients", patientId, "anamnesis"],
    queryFn: () => patientsApi.getAnamnesis(patientId),
  });

  const { register, handleSubmit, reset, formState } = useForm<UpsertAnamnesisInput>({
    resolver: zodResolver(upsertAnamnesisSchema),
  });

  useEffect(() => {
    if (anamnesisQuery.data) {
      reset({
        chiefComplaint: anamnesisQuery.data.chiefComplaint ?? "",
        allergies: anamnesisQuery.data.allergies ?? "",
        medications: anamnesisQuery.data.medications ?? "",
        healthConditions: anamnesisQuery.data.healthConditions ?? "",
        dentalHistory: anamnesisQuery.data.dentalHistory ?? "",
      });
    }
  }, [anamnesisQuery.data, reset]);

  const mutation = useMutation({
    mutationFn: (data: UpsertAnamnesisInput) => patientsApi.upsertAnamnesis(patientId, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["patients", patientId, "anamnesis"] }),
  });

  return (
    <form
      onSubmit={handleSubmit((data) => mutation.mutate(data))}
      className="max-w-2xl space-y-4 rounded-lg border border-line bg-surface p-6"
    >
      {FIELDS.map((field) => (
        <div key={field.name}>
          <label className="mb-1 block text-sm text-muted">{field.label}</label>
          <textarea
            className="w-full rounded-md border border-line px-3 py-2 text-sm"
            rows={field.name === "chiefComplaint" ? 2 : 3}
            {...register(field.name)}
          />
        </div>
      ))}
      <button
        type="submit"
        disabled={formState.isSubmitting}
        className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {mutation.isSuccess ? "Salvo ✓" : "Salvar anamnese"}
      </button>
    </form>
  );
}
