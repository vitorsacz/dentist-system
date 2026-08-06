import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createBudgetSchema, type CreateBudgetInput } from "@dentist-system/shared-types";
import { patientsApi, type ToothRecord } from "../api";
import { proceduresApi } from "@/features/procedures/api";

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendente",
  APPROVED: "Aprovado",
  IN_PROGRESS: "Em andamento",
  COMPLETED: "Concluído",
};

function latestPlannedByTooth(records: ToothRecord[]) {
  const latestByTooth = new Map<number, ToothRecord>();
  for (const record of records) {
    const current = latestByTooth.get(record.toothNumber);
    if (!current || new Date(record.updatedAt) > new Date(current.updatedAt)) {
      latestByTooth.set(record.toothNumber, record);
    }
  }
  return [...latestByTooth.values()]
    .filter((record) => record.status === "PLANNED")
    .sort((a, b) => a.toothNumber - b.toothNumber);
}

export function BudgetsTab({ patientId }: { patientId: string }) {
  const queryClient = useQueryClient();
  const [addedRecordIds, setAddedRecordIds] = useState<Set<string>>(new Set());
  const budgetsQuery = useQuery({
    queryKey: ["patients", patientId, "budgets"],
    queryFn: () => patientsApi.listBudgets(patientId),
  });
  const proceduresQuery = useQuery({ queryKey: ["procedures"], queryFn: proceduresApi.list });
  const toothRecordsQuery = useQuery({
    queryKey: ["patients", patientId, "tooth-records"],
    queryFn: () => patientsApi.listToothRecords(patientId),
  });

  const { register, control, handleSubmit, reset, setValue, formState } = useForm<CreateBudgetInput>({
    resolver: zodResolver(createBudgetSchema),
    defaultValues: { patientId, items: [{ procedureId: "", value: 0 }] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  const plannedSuggestions = latestPlannedByTooth(toothRecordsQuery.data ?? []).filter(
    (record) => !addedRecordIds.has(record.id),
  );

  function addSuggestion(record: ToothRecord) {
    const normalizedRecordProcedure = record.procedure.trim().toLowerCase();
    const matchedProcedure = proceduresQuery.data?.find((p) => {
      const normalizedCatalogName = p.name.trim().toLowerCase();
      return (
        normalizedCatalogName === normalizedRecordProcedure ||
        normalizedCatalogName.includes(normalizedRecordProcedure) ||
        normalizedRecordProcedure.includes(normalizedCatalogName)
      );
    });
    append({
      procedureId: matchedProcedure?.id ?? "",
      toothNumber: record.toothNumber,
      value: matchedProcedure?.defaultValue ?? 0,
      notes: record.notes ?? record.procedure,
    });
    setAddedRecordIds((prev) => new Set(prev).add(record.id));
  }

  const createMutation = useMutation({
    mutationFn: patientsApi.createBudget,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patients", patientId, "budgets"] });
      reset({ patientId, items: [{ procedureId: "", value: 0 }] });
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => patientsApi.updateBudgetStatus(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["patients", patientId, "budgets"] }),
  });

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleSubmit((data) => createMutation.mutate(data))}
        className="max-w-2xl space-y-4 rounded-lg border border-line bg-surface p-6"
      >
        <h2 className="font-medium text-ink">Novo orçamento</h2>
        <input type="hidden" {...register("patientId")} />

        {plannedSuggestions.length > 0 && (
          <div className="space-y-2 rounded-md border border-line bg-app p-3">
            <p className="text-xs text-muted">
              Sugestões a partir do odontograma (dentes planejados):
            </p>
            <div className="flex flex-wrap gap-2">
              {plannedSuggestions.map((record) => (
                <button
                  key={record.id}
                  type="button"
                  onClick={() => addSuggestion(record)}
                  className="rounded-full border border-accent bg-accent-soft px-3 py-1 text-xs font-medium text-accent"
                >
                  + Dente {record.toothNumber} — {record.procedure}
                </button>
              ))}
            </div>
          </div>
        )}

        {fields.map((field, index) => (
          <div key={field.id} className="grid grid-cols-[2fr_1fr_1fr_auto] items-end gap-2">
            <div>
              <label className="mb-1 block text-sm text-muted">Procedimento</label>
              <select
                className="w-full rounded-md border border-line px-3 py-2 text-sm"
                {...register(`items.${index}.procedureId`, {
                  onChange: (e) => {
                    const procedure = proceduresQuery.data?.find((p) => p.id === e.target.value);
                    if (procedure) {
                      setValue(`items.${index}.value`, procedure.defaultValue);
                    }
                  },
                })}
              >
                <option value="">Selecione</option>
                {proceduresQuery.data?.map((procedure) => (
                  <option key={procedure.id} value={procedure.id}>
                    {procedure.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted">Dente (opcional)</label>
              <input
                className="w-full rounded-md border border-line px-3 py-2 text-sm"
                {...register(`items.${index}.toothNumber`, { valueAsNumber: true })}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted">Valor</label>
              <input
                type="number"
                step="0.01"
                className="w-full rounded-md border border-line px-3 py-2 text-sm"
                {...register(`items.${index}.value`, { valueAsNumber: true })}
              />
            </div>
            <button
              type="button"
              onClick={() => remove(index)}
              className="rounded-md border border-line px-2 py-2 text-sm text-muted"
            >
              Remover
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={() => append({ procedureId: "", value: 0 })}
          className="text-sm text-accent"
        >
          + adicionar procedimento
        </button>

        <button
          type="submit"
          disabled={formState.isSubmitting}
          className="block rounded-md bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          Salvar orçamento
        </button>
      </form>

      <div className="space-y-3">
        {budgetsQuery.data?.map((budget) => (
          <div key={budget.id} className="rounded-lg border border-line bg-surface p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted">{new Date(budget.createdAt).toLocaleDateString("pt-BR")}</span>
              <select
                value={budget.status}
                onChange={(e) => statusMutation.mutate({ id: budget.id, status: e.target.value })}
                className="rounded-md border border-line px-2 py-1 text-sm"
              >
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <ul className="mt-2 space-y-1 text-sm">
              {budget.items.map((item) => (
                <li key={item.id} className="flex justify-between">
                  <span>
                    {item.procedure.name}
                    {item.toothNumber ? ` (dente ${item.toothNumber})` : ""}
                  </span>
                  <span className="tabular">R$ {item.value.toFixed(2)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex justify-between border-t border-line pt-2 text-sm font-medium">
              <span>Total</span>
              <span className="tabular">R$ {budget.total.toFixed(2)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
