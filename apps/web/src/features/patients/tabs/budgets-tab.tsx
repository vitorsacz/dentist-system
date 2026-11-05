import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Printer } from "lucide-react";
import { createBudgetSchema, type CreateBudgetInput } from "@dentist-system/shared-types";
import { patientsApi, type ToothRecord } from "../api";
import { proceduresApi } from "@/features/procedures/api";
import { myClinicApi } from "@/features/my-clinic/api";

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

function formatCurrency(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}



interface PrintBudgetProps {
  orgName: string;
  orgPhone?: string | null;
  orgEmail?: string | null;
  orgAddress?: string | null;
  orgLogoDataUrl?: string | null;
  patientId: string;
  items: { procedureName: string; toothNumber?: number | null; notes?: string | null; value: number }[];
  total: number;
  createdAt: string;
}

function PrintPreview({ orgName, orgPhone, orgEmail, orgAddress, orgLogoDataUrl, patientId, items, total, createdAt }: PrintBudgetProps) {
  return (
    <div className="print-only" style={{ fontFamily: "sans-serif", padding: "32px", maxWidth: "800px" }}>
      {/* Letterhead */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: "16px", marginBottom: "24px", borderBottom: "2px solid #e5e7eb", paddingBottom: "16px" }}>
        {orgLogoDataUrl && (
          <img src={orgLogoDataUrl} alt="Logo" style={{ maxHeight: "64px", maxWidth: "160px", objectFit: "contain" }} />
        )}
        <div>
          <div style={{ fontSize: "20px", fontWeight: 700 }}>{orgName}</div>
          {orgPhone && <div style={{ fontSize: "13px", color: "#6b7280" }}>{orgPhone}</div>}
          {orgEmail && <div style={{ fontSize: "13px", color: "#6b7280" }}>{orgEmail}</div>}
          {orgAddress && <div style={{ fontSize: "13px", color: "#6b7280" }}>{orgAddress}</div>}
        </div>
      </div>

      <div style={{ marginBottom: "16px" }}>
        <div style={{ fontSize: "18px", fontWeight: 600 }}>Orçamento</div>
        <div style={{ fontSize: "13px", color: "#6b7280" }}>
          Paciente ID: {patientId} · {new Date(createdAt).toLocaleDateString("pt-BR")}
        </div>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
        <thead>
          <tr style={{ background: "#f9fafb" }}>
            <th style={{ textAlign: "left", padding: "8px", borderBottom: "1px solid #e5e7eb" }}>Procedimento</th>
            <th style={{ textAlign: "left", padding: "8px", borderBottom: "1px solid #e5e7eb" }}>Dente</th>
            <th style={{ textAlign: "left", padding: "8px", borderBottom: "1px solid #e5e7eb" }}>Descrição</th>
            <th style={{ textAlign: "right", padding: "8px", borderBottom: "1px solid #e5e7eb" }}>Valor</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i}>
              <td style={{ padding: "8px", borderBottom: "1px solid #f3f4f6" }}>{item.procedureName}</td>
              <td style={{ padding: "8px", borderBottom: "1px solid #f3f4f6" }}>{item.toothNumber ?? "—"}</td>
              <td style={{ padding: "8px", borderBottom: "1px solid #f3f4f6" }}>{item.notes ?? "—"}</td>
              <td style={{ padding: "8px", borderBottom: "1px solid #f3f4f6", textAlign: "right" }}>{formatCurrency(item.value)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3} style={{ padding: "8px", fontWeight: 600, textAlign: "right" }}>Total</td>
            <td style={{ padding: "8px", fontWeight: 700, textAlign: "right" }}>{formatCurrency(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export function BudgetsTab({ patientId }: { patientId: string }) {
  const queryClient = useQueryClient();
  const [addedRecordIds, setAddedRecordIds] = useState<Set<string>>(new Set());
  const [printBudgetId, setPrintBudgetId] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const budgetsQuery = useQuery({
    queryKey: ["patients", patientId, "budgets"],
    queryFn: () => patientsApi.listBudgets(patientId),
  });
  const proceduresQuery = useQuery({ queryKey: ["procedures"], queryFn: proceduresApi.list });
  const toothRecordsQuery = useQuery({
    queryKey: ["patients", patientId, "tooth-records"],
    queryFn: () => patientsApi.listToothRecords(patientId),
  });
  const orgQuery = useQuery({ queryKey: ["my-clinic"], queryFn: myClinicApi.get });

  // Local qty/unitValue per row — not in RHF because they don't go to API directly
  const [rowMeta, setRowMeta] = useState<{ qty: number; unitValue: number }[]>([{ qty: 1, unitValue: 0 }]);

  const { register, control, handleSubmit, reset, setValue, formState } = useForm<CreateBudgetInput>({
    resolver: zodResolver(createBudgetSchema),
    defaultValues: { patientId, items: [{ procedureId: "", value: 0 }] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const formTotal = rowMeta.reduce((sum, row) => sum + row.qty * row.unitValue, 0);

  function updateRowValue(index: number, qty: number, unitValue: number) {
    setRowMeta((prev) => {
      const next = [...prev];
      next[index] = { qty, unitValue };
      return next;
    });
    setValue(`items.${index}.value`, qty * unitValue);
  }

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
    const unitValue = matchedProcedure?.defaultValue ?? 0;
    append({
      procedureId: matchedProcedure?.id ?? "",
      toothNumber: record.toothNumber,
      value: unitValue,
      notes: record.notes ?? record.procedure,
    });
    setRowMeta((prev) => [...prev, { qty: 1, unitValue }]);
    setAddedRecordIds((prev) => new Set(prev).add(record.id));
  }

  const createMutation = useMutation({
    mutationFn: patientsApi.createBudget,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patients", patientId, "budgets"] });
      reset({ patientId, items: [{ procedureId: "", value: 0 }] });
      setRowMeta([{ qty: 1, unitValue: 0 }]);
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => patientsApi.updateBudgetStatus(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["patients", patientId, "budgets"] }),
  });

  function handlePrint(budgetId: string) {
    setPrintBudgetId(budgetId);
    // Allow React to render the print-only div before triggering print
    requestAnimationFrame(() => {
      window.print();
      setPrintBudgetId(null);
    });
  }

  const printBudget = printBudgetId ? budgetsQuery.data?.find((b) => b.id === printBudgetId) : null;
  const org = orgQuery.data;

  return (
    <div className="space-y-6">
      {/* Hidden print layout — rendered only when printBudgetId is set */}
      {printBudget && org && (
        <div ref={printRef} className="hidden print:block">
          <PrintPreview
            orgName={org.name}
            orgPhone={org.phone}
            orgEmail={org.email}
            orgAddress={org.address}
            orgLogoDataUrl={org.logoDataUrl}
            patientId={patientId}
            items={printBudget.items.map((item) => ({
              procedureName: item.procedure.name,
              toothNumber: item.toothNumber,
              notes: item.notes,
              value: item.value,
            }))}
            total={printBudget.total}
            createdAt={printBudget.createdAt}
          />
        </div>
      )}

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
          <div key={field.id} className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] items-end gap-2">
            <div>
              <label className="mb-1 block text-sm text-muted">Procedimento</label>
              <select
                className="w-full rounded-md border border-line px-3 py-2 text-sm"
                {...register(`items.${index}.procedureId`, {
                  onChange: (e) => {
                    const procedure = proceduresQuery.data?.find((p) => p.id === e.target.value);
                    const unitValue = procedure?.defaultValue ?? 0;
                    const qty = rowMeta[index]?.qty ?? 1;
                    updateRowValue(index, qty, unitValue);
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
              <label className="mb-1 block text-sm text-muted">Descrição</label>
              <input
                className="w-full rounded-md border border-line px-3 py-2 text-sm"
                placeholder="Livre"
                {...register(`items.${index}.notes`)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted">Dente</label>
              <input
                className="w-full rounded-md border border-line px-3 py-2 text-sm"
                {...register(`items.${index}.toothNumber`, { valueAsNumber: true })}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted">Qtd</label>
              <input
                type="number"
                min={1}
                step={1}
                value={rowMeta[index]?.qty ?? 1}
                onChange={(e) => {
                  const qty = Math.max(1, Number(e.target.value));
                  const unitValue = rowMeta[index]?.unitValue ?? 0;
                  updateRowValue(index, qty, unitValue);
                }}
                className="w-full rounded-md border border-line px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted">Valor unit.</label>
              <input
                type="number"
                step="0.01"
                value={rowMeta[index]?.unitValue ?? 0}
                onChange={(e) => {
                  const unitValue = Number(e.target.value);
                  const qty = rowMeta[index]?.qty ?? 1;
                  updateRowValue(index, qty, unitValue);
                }}
                className="w-full rounded-md border border-line px-3 py-2 text-sm"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                remove(index);
                setRowMeta((prev) => prev.filter((_, i) => i !== index));
              }}
              className="rounded-md border border-line px-2 py-2 text-sm text-muted"
            >
              Remover
            </button>
          </div>
        ))}

        {/* Running total */}
        <div className="flex justify-end text-sm font-medium text-ink">
          Total estimado: {formatCurrency(formTotal)}
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => {
              append({ procedureId: "", value: 0 });
              setRowMeta((prev) => [...prev, { qty: 1, unitValue: 0 }]);
            }}
            className="text-sm text-accent"
          >
            + adicionar procedimento
          </button>
        </div>

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
              <div className="flex items-center gap-2">
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
                <button
                  type="button"
                  onClick={() => handlePrint(budget.id)}
                  className="flex items-center gap-1.5 rounded-md border border-line px-2 py-1 text-sm text-ink hover:bg-gray-100"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Imprimir
                </button>
              </div>
            </div>
            <ul className="mt-2 space-y-1 text-sm">
              {budget.items.map((item) => (
                <li key={item.id} className="flex justify-between">
                  <span>
                    {item.procedure.name}
                    {item.toothNumber ? ` (dente ${item.toothNumber})` : ""}
                    {item.notes ? ` — ${item.notes}` : ""}
                  </span>
                  <span className="tabular">{formatCurrency(item.value)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex justify-between border-t border-line pt-2 text-sm font-medium">
              <span>Total</span>
              <span className="tabular">{formatCurrency(budget.total)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
