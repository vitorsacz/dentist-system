import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createClinicalRecordSchema,
  type CreateClinicalRecordInput,
} from "@dentist-system/shared-types";
import { patientsApi } from "../api";

export function ClinicalRecordsTab({ patientId }: { patientId: string }) {
  const queryClient = useQueryClient();
  const recordsQuery = useQuery({
    queryKey: ["patients", patientId, "clinical-records"],
    queryFn: () => patientsApi.listClinicalRecords(patientId),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateClinicalRecordInput>({
    resolver: zodResolver(createClinicalRecordSchema),
    defaultValues: { date: new Date() },
  });

  const mutation = useMutation({
    mutationFn: (data: CreateClinicalRecordInput) => patientsApi.createClinicalRecord(patientId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patients", patientId, "clinical-records"] });
      reset({ date: new Date(), procedureNote: "", observations: "" });
    },
  });

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleSubmit((data) => mutation.mutate(data))}
        className="max-w-2xl space-y-4 rounded-lg border border-line bg-surface p-6"
      >
        <h2 className="font-medium text-ink">Nova evolução</h2>
        <div>
          <label className="mb-1 block text-sm text-muted">Data</label>
          <input
            type="date"
            className="w-full rounded-md border border-line px-3 py-2 text-sm"
            {...register("date")}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-muted">Procedimento realizado</label>
          <input
            className="w-full rounded-md border border-line px-3 py-2 text-sm"
            {...register("procedureNote")}
          />
          {errors.procedureNote && <p className="mt-1 text-sm text-bad">{errors.procedureNote.message}</p>}
        </div>
        <div>
          <label className="mb-1 block text-sm text-muted">Observações</label>
          <textarea
            rows={3}
            className="w-full rounded-md border border-line px-3 py-2 text-sm"
            {...register("observations")}
          />
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          Registrar
        </button>
      </form>

      <div className="space-y-3">
        {recordsQuery.data?.map((record) => (
          <div key={record.id} className="rounded-lg border border-line bg-surface p-4">
            <div className="flex justify-between text-sm text-muted">
              <span>{new Date(record.date).toLocaleDateString("pt-BR")}</span>
            </div>
            <p className="mt-1 text-sm text-ink">{record.procedureNote}</p>
            {record.observations && <p className="mt-1 text-sm text-muted">{record.observations}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
