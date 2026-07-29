import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createAttendanceSchema, type CreateAttendanceInput } from "@dentist-system/shared-types";
import { attendancesApi } from "./api";
import { patientsApi } from "@/features/patients/api";
import { clinicsApi } from "@/features/clinics/api";
import { proceduresApi } from "@/features/procedures/api";
import { materialsApi } from "@/features/materials/api";

export function AttendanceForm() {
  const queryClient = useQueryClient();
  const patientsQuery = useQuery({ queryKey: ["patients"], queryFn: patientsApi.list });
  const clinicsQuery = useQuery({ queryKey: ["clinics"], queryFn: clinicsApi.list });
  const proceduresQuery = useQuery({ queryKey: ["procedures"], queryFn: proceduresApi.list });
  const materialsQuery = useQuery({ queryKey: ["materials"], queryFn: materialsApi.list });

  const { register, control, handleSubmit, reset, setValue, formState } = useForm<CreateAttendanceInput>({
    resolver: zodResolver(createAttendanceSchema),
    defaultValues: { materialCost: 0, materialUsages: [] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "materialUsages" });

  const mutation = useMutation({
    mutationFn: attendancesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["materials"] });
      reset({ materialCost: 0, materialUsages: [] });
    },
  });

  return (
    <form
      onSubmit={handleSubmit((data) => mutation.mutate(data))}
      className="grid max-w-2xl gap-4 rounded-lg border border-line bg-surface p-6 sm:grid-cols-2"
    >
      <h2 className="font-medium text-ink sm:col-span-2">Registrar atendimento</h2>

      <div>
        <label className="mb-1 block text-sm text-muted">Paciente</label>
        <select className="w-full rounded-md border border-line px-3 py-2 text-sm" {...register("patientId")}>
          <option value="">Selecione</option>
          {patientsQuery.data?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-sm text-muted">Consultório</label>
        <select className="w-full rounded-md border border-line px-3 py-2 text-sm" {...register("clinicId")}>
          <option value="">Selecione</option>
          {clinicsQuery.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-sm text-muted">Procedimento</label>
        <select
          className="w-full rounded-md border border-line px-3 py-2 text-sm"
          {...register("procedureId", {
            onChange: (e) => {
              const procedure = proceduresQuery.data?.find((p) => p.id === e.target.value);
              if (procedure) setValue("grossValue", procedure.defaultValue);
            },
          })}
        >
          <option value="">Selecione</option>
          {proceduresQuery.data?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-sm text-muted">Data</label>
        <input type="date" className="w-full rounded-md border border-line px-3 py-2 text-sm" {...register("date")} />
      </div>
      <div>
        <label className="mb-1 block text-sm text-muted">Valor bruto (R$)</label>
        <input
          type="number"
          step="0.01"
          className="w-full rounded-md border border-line px-3 py-2 text-sm"
          {...register("grossValue", { valueAsNumber: true })}
        />
      </div>
      <div>
        <label className="mb-1 block text-sm text-muted">% de repasse</label>
        <input
          type="number"
          step="0.01"
          className="w-full rounded-md border border-line px-3 py-2 text-sm"
          {...register("repassePercentage", { valueAsNumber: true })}
        />
      </div>
      <div>
        <label className="mb-1 block text-sm text-muted">Custo de material (R$)</label>
        <input
          type="number"
          step="0.01"
          className="w-full rounded-md border border-line px-3 py-2 text-sm"
          {...register("materialCost", { valueAsNumber: true })}
        />
      </div>

      <div className="space-y-2 sm:col-span-2">
        <label className="block text-sm text-muted">Materiais utilizados (baixa de estoque)</label>
        {fields.map((field, index) => (
          <div key={field.id} className="flex items-center gap-2">
            <select
              className="flex-1 rounded-md border border-line px-3 py-2 text-sm"
              {...register(`materialUsages.${index}.materialId`)}
            >
              <option value="">Selecione o material</option>
              {materialsQuery.data?.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <input
              type="number"
              step="0.01"
              placeholder="Qtd."
              className="w-24 rounded-md border border-line px-3 py-2 text-sm"
              {...register(`materialUsages.${index}.quantity`, { valueAsNumber: true })}
            />
            <button type="button" onClick={() => remove(index)} className="text-sm text-muted">
              remover
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => append({ materialId: "", quantity: 1 })}
          className="text-sm text-accent"
        >
          + adicionar material
        </button>
      </div>

      <button
        type="submit"
        disabled={formState.isSubmitting}
        className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-60 sm:col-span-2"
      >
        {mutation.isSuccess ? "Registrado ✓" : "Registrar"}
      </button>
    </form>
  );
}
