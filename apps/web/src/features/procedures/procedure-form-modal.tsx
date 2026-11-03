import { useState } from "react";
import type { Procedure } from "./api";

interface ProcedureFormModalProps {
  editingProcedure?: Procedure | null;
  onClose: () => void;
  onSave: (input: { name: string; defaultValue: number; active: boolean }) => void;
  isSaving?: boolean;
}

export function ProcedureFormModal({ editingProcedure, onClose, onSave, isSaving }: ProcedureFormModalProps) {
  const isEditing = Boolean(editingProcedure);

  const [name, setName] = useState(editingProcedure?.name ?? "");
  const [price, setPrice] = useState(String(editingProcedure?.defaultValue ?? ""));
  const [active, setActive] = useState(editingProcedure ? editingProcedure.active : true);

  const priceValue = Number(price);
  const canSubmit = name.trim().length > 0 && priceValue >= 0;

  function handleSubmit() {
    if (!canSubmit) return;
    onSave({ name: name.trim(), defaultValue: priceValue, active });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 p-4">
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6">
        <h2 className="mb-4 text-xl font-semibold text-ink">
          {isEditing ? "Editar procedimento" : "Novo procedimento"}
        </h2>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink">Nome</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Limpeza (profilaxia)"
              className="w-full rounded-lg border border-line px-3 py-2 text-sm text-ink placeholder:text-muted"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink">Valor padrão (R$)</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full rounded-lg border border-line px-3 py-2 text-sm text-ink"
            />
          </div>

          <label className="flex items-center gap-2.5 text-sm text-ink">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="h-4 w-4 rounded"
            />
            Procedimento ativo
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || isSaving}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {isEditing ? "Salvar alterações" : "Adicionar procedimento"}
          </button>
        </div>
      </div>
    </div>
  );
}
