import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createClinicalRecordSchema,
  type CreateClinicalRecordInput,
} from "@dentist-system/shared-types";
import { QueryStateWrapper } from "@/lib/use-query-state";
import { patientsApi, type ClinicalRecord } from "../api";

function AddendumForm({
  patientId,
  recordId,
  onDone,
}: {
  patientId: string;
  recordId: string;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const mutation = useMutation({
    mutationFn: () => patientsApi.createAddendum(patientId, recordId, text),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patients", patientId, "clinical-records"] });
      setText("");
      onDone();
    },
  });
  return (
    <div className="mt-3 space-y-2 border-t border-line pt-3">
      <textarea
        rows={2}
        placeholder="Texto do adendo"
        className="w-full rounded-md border border-line px-3 py-2 text-sm"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!text.trim() || mutation.isPending}
          onClick={() => mutation.mutate()}
          className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
        >
          Salvar adendo
        </button>
        <button type="button" onClick={onDone} className="text-xs text-muted">
          Cancelar
        </button>
      </div>
    </div>
  );
}

function RecordCard({
  record,
  patientId,
  readOnly,
}: {
  record: ClinicalRecord;
  patientId: string;
  readOnly?: boolean;
}) {
  const [addingAddendum, setAddingAddendum] = useState(false);
  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <div className="flex items-start justify-between text-sm text-muted">
        <span>{new Date(record.date).toLocaleDateString("pt-BR")}</span>
        {!readOnly && (
          <button
            type="button"
            onClick={() => setAddingAddendum(true)}
            className="text-xs text-accent hover:underline"
          >
            + Adendo
          </button>
        )}
      </div>
      <p className="mt-1 text-sm text-ink">{record.procedureNote}</p>
      {record.observations && <p className="mt-1 text-sm text-muted">{record.observations}</p>}

      {record.addenda.length > 0 && (
        <div className="mt-3 space-y-2 border-t border-line pt-3">
          {record.addenda.map((a) => (
            <div key={a.id} className="rounded-md bg-warn/5 px-3 py-2 text-xs">
              <div className="mb-0.5 flex justify-between text-muted">
                <span>Adendo — {a.createdBy.name}</span>
                <span>{new Date(a.createdAt).toLocaleString("pt-BR")}</span>
              </div>
              <p className="text-ink">{a.text}</p>
            </div>
          ))}
        </div>
      )}

      {addingAddendum && (
        <AddendumForm
          patientId={patientId}
          recordId={record.id}
          onDone={() => setAddingAddendum(false)}
        />
      )}
    </div>
  );
}

export function ClinicalRecordsTab({ patientId, readOnly }: { patientId: string; readOnly?: boolean }) {
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
      {!readOnly && (
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
      )}

      <QueryStateWrapper query={recordsQuery}>
        {(records) => (
          <div className="space-y-3">
            {records.map((record) => (
              <RecordCard key={record.id} record={record} patientId={patientId} readOnly={readOnly} />
            ))}
          </div>
        )}
      </QueryStateWrapper>
    </div>
  );
}
