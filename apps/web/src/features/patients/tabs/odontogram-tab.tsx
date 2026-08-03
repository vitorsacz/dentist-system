import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { upsertToothRecordSchema, type UpsertToothRecordInput } from "@dentist-system/shared-types";
import { patientsApi, type ToothRecord } from "../api";

const UPPER_RIGHT = [18, 17, 16, 15, 14, 13, 12, 11];
const UPPER_LEFT = [21, 22, 23, 24, 25, 26, 27, 28];
const LOWER_RIGHT = [48, 47, 46, 45, 44, 43, 42, 41];
const LOWER_LEFT = [31, 32, 33, 34, 35, 36, 37, 38];

function latestStatus(records: ToothRecord[]): "DONE" | "PLANNED" | "NONE" {
  if (records.length === 0) return "NONE";
  const [latest] = [...records].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
  return latest!.status as "DONE" | "PLANNED";
}

function toothColorClass(status: "DONE" | "PLANNED" | "NONE") {
  if (status === "DONE") return "border-good bg-good/10 text-good";
  if (status === "PLANNED") return "border-accent bg-accent-soft text-accent";
  return "border-line bg-surface text-muted";
}

function ToothButton({
  tooth,
  status,
  selected,
  onClick,
}: {
  tooth: number;
  status: "DONE" | "PLANNED" | "NONE";
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-10 w-10 items-center justify-center rounded-md border text-sm font-medium transition ${toothColorClass(
        status,
      )} ${selected ? "ring-2 ring-accent ring-offset-2" : ""}`}
    >
      {tooth}
    </button>
  );
}

function ToothRow({
  right,
  left,
  recordsByTooth,
  selectedTooth,
  onSelect,
}: {
  right: number[];
  left: number[];
  recordsByTooth: Map<number, ToothRecord[]>;
  selectedTooth: number | null;
  onSelect: (tooth: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex gap-1.5">
        {right.map((tooth) => (
          <ToothButton
            key={tooth}
            tooth={tooth}
            status={latestStatus(recordsByTooth.get(tooth) ?? [])}
            selected={selectedTooth === tooth}
            onClick={() => onSelect(tooth)}
          />
        ))}
      </div>
      <div className="h-10 w-px bg-line" />
      <div className="flex gap-1.5">
        {left.map((tooth) => (
          <ToothButton
            key={tooth}
            tooth={tooth}
            status={latestStatus(recordsByTooth.get(tooth) ?? [])}
            selected={selectedTooth === tooth}
            onClick={() => onSelect(tooth)}
          />
        ))}
      </div>
    </div>
  );
}

export function OdontogramTab({ patientId }: { patientId: string }) {
  const queryClient = useQueryClient();
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null);

  const recordsQuery = useQuery({
    queryKey: ["patients", patientId, "tooth-records"],
    queryFn: () => patientsApi.listToothRecords(patientId),
  });

  const recordsByTooth = new Map<number, ToothRecord[]>();
  for (const record of recordsQuery.data ?? []) {
    const list = recordsByTooth.get(record.toothNumber) ?? [];
    list.push(record);
    recordsByTooth.set(record.toothNumber, list);
  }

  const selectedRecords = selectedTooth
    ? (recordsByTooth.get(selectedTooth) ?? []).sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      )
    : [];

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<UpsertToothRecordInput>({
    resolver: zodResolver(upsertToothRecordSchema),
    defaultValues: { status: "PLANNED" },
  });

  const mutation = useMutation({
    mutationFn: (data: UpsertToothRecordInput) => patientsApi.createToothRecord(patientId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patients", patientId, "tooth-records"] });
      reset({ status: "PLANNED", toothNumber: selectedTooth ?? undefined, procedure: "", notes: "" });
    },
  });

  const completeMutation = useMutation({
    mutationFn: (recordId: string) => patientsApi.updateToothRecordStatus(patientId, recordId, "DONE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patients", patientId, "tooth-records"] });
    },
  });

  function selectTooth(tooth: number) {
    setSelectedTooth(tooth);
    setValue("toothNumber", tooth);
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4 rounded-lg border border-line bg-surface p-6">
        <div className="flex justify-center gap-6 overflow-x-auto py-2">
          <ToothRow
            right={UPPER_RIGHT}
            left={UPPER_LEFT}
            recordsByTooth={recordsByTooth}
            selectedTooth={selectedTooth}
            onSelect={selectTooth}
          />
        </div>
        <div className="flex justify-center gap-6 overflow-x-auto py-2">
          <ToothRow
            right={LOWER_RIGHT}
            left={LOWER_LEFT}
            recordsByTooth={recordsByTooth}
            selectedTooth={selectedTooth}
            onSelect={selectTooth}
          />
        </div>
        <div className="flex justify-center gap-4 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded border border-line bg-surface" /> Sem registro
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded border border-accent bg-accent-soft" /> Planejado
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded border border-good bg-good/10" /> Realizado
          </span>
        </div>
      </div>

      {selectedTooth === null ? (
        <p className="text-sm text-muted">Selecione um dente no mapa para ver o histórico e registrar um procedimento.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <h2 className="font-medium text-ink">Histórico — dente {selectedTooth}</h2>
            {selectedRecords.length === 0 && (
              <p className="text-sm text-muted">Nenhum registro para este dente ainda.</p>
            )}
            {selectedRecords.map((record) => (
              <div key={record.id} className="rounded-lg border border-line bg-surface p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-ink">{record.procedure}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      record.status === "DONE" ? "bg-good/10 text-good" : "bg-accent-soft text-accent"
                    }`}
                  >
                    {record.status === "DONE" ? "Realizado" : "Planejado"}
                  </span>
                </div>
                {record.notes && <p className="mt-1 text-sm text-muted">{record.notes}</p>}
                <div className="mt-1 flex items-center justify-between">
                  <p className="text-xs text-muted">
                    {new Date(record.updatedAt).toLocaleDateString("pt-BR")}
                  </p>
                  {record.status === "PLANNED" && (
                    <button
                      type="button"
                      onClick={() => completeMutation.mutate(record.id)}
                      disabled={completeMutation.isPending}
                      className="text-xs font-medium text-good disabled:opacity-60"
                    >
                      Marcar como realizado
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <form
            onSubmit={handleSubmit((data) => mutation.mutate(data))}
            className="h-fit space-y-4 rounded-lg border border-line bg-surface p-6"
          >
            <h2 className="font-medium text-ink">Novo registro — dente {selectedTooth}</h2>
            <input type="hidden" {...register("toothNumber", { valueAsNumber: true })} />
            <div>
              <label className="mb-1 block text-sm text-muted">Procedimento</label>
              <input
                className="w-full rounded-md border border-line px-3 py-2 text-sm"
                {...register("procedure")}
              />
              {errors.procedure && <p className="mt-1 text-sm text-bad">{errors.procedure.message}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted">Status</label>
              <select className="w-full rounded-md border border-line px-3 py-2 text-sm" {...register("status")}>
                <option value="PLANNED">Planejado</option>
                <option value="DONE">Realizado</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted">Notas</label>
              <input className="w-full rounded-md border border-line px-3 py-2 text-sm" {...register("notes")} />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-md bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              Adicionar registro
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
