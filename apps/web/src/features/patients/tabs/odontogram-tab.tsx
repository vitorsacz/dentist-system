import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { upsertToothRecordSchema, type UpsertToothRecordInput } from "@dentist-system/shared-types";
import { patientsApi } from "../api";

const FDI_TEETH = [
  11, 12, 13, 14, 15, 16, 17, 18, 21, 22, 23, 24, 25, 26, 27, 28, 31, 32, 33, 34, 35, 36, 37, 38, 41, 42,
  43, 44, 45, 46, 47, 48,
];

export function OdontogramTab({ patientId }: { patientId: string }) {
  const queryClient = useQueryClient();
  const recordsQuery = useQuery({
    queryKey: ["patients", patientId, "tooth-records"],
    queryFn: () => patientsApi.listToothRecords(patientId),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UpsertToothRecordInput>({
    resolver: zodResolver(upsertToothRecordSchema),
    defaultValues: { status: "PLANNED" },
  });

  const mutation = useMutation({
    mutationFn: (data: UpsertToothRecordInput) => patientsApi.createToothRecord(patientId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patients", patientId, "tooth-records"] });
      reset({ status: "PLANNED", toothNumber: undefined, procedure: "", notes: "" });
    },
  });

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleSubmit((data) => mutation.mutate(data))}
        className="grid max-w-2xl gap-4 rounded-lg border border-line bg-surface p-6 sm:grid-cols-3"
      >
        <div>
          <label className="mb-1 block text-sm text-muted">Dente (FDI)</label>
          <select
            className="w-full rounded-md border border-line px-3 py-2 text-sm"
            {...register("toothNumber", { valueAsNumber: true })}
          >
            <option value="">Selecione</option>
            {FDI_TEETH.map((tooth) => (
              <option key={tooth} value={tooth}>
                {tooth}
              </option>
            ))}
          </select>
          {errors.toothNumber && <p className="mt-1 text-sm text-bad">{errors.toothNumber.message}</p>}
        </div>
        <div>
          <label className="mb-1 block text-sm text-muted">Procedimento</label>
          <input className="w-full rounded-md border border-line px-3 py-2 text-sm" {...register("procedure")} />
        </div>
        <div>
          <label className="mb-1 block text-sm text-muted">Status</label>
          <select className="w-full rounded-md border border-line px-3 py-2 text-sm" {...register("status")}>
            <option value="PLANNED">Planejado</option>
            <option value="DONE">Realizado</option>
          </select>
        </div>
        <div className="sm:col-span-3">
          <label className="mb-1 block text-sm text-muted">Notas</label>
          <input className="w-full rounded-md border border-line px-3 py-2 text-sm" {...register("notes")} />
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-60 sm:col-span-3"
        >
          Adicionar registro
        </button>
      </form>

      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-muted">
            <tr>
              <th className="px-4 py-3">Dente</th>
              <th className="px-4 py-3">Procedimento</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Notas</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {recordsQuery.data?.map((record) => (
              <tr key={record.id}>
                <td className="px-4 py-3">{record.toothNumber}</td>
                <td className="px-4 py-3">{record.procedure}</td>
                <td className="px-4 py-3">{record.status === "DONE" ? "Realizado" : "Planejado"}</td>
                <td className="px-4 py-3 text-muted">{record.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
