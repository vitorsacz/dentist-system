import { useState } from "react";
import type { AnamnesisQuestion } from "./api";
import type { CreateAnamnesisQuestionInput, UpdateAnamnesisQuestionInput } from "@dentist-system/shared-types";

interface QuestionFormModalProps {
  editing: AnamnesisQuestion | null;
  onClose: () => void;
  onCreate: (input: CreateAnamnesisQuestionInput) => void;
  onUpdate: (id: string, input: UpdateAnamnesisQuestionInput) => void;
  isSaving?: boolean;
}

export function QuestionFormModal({ editing, onClose, onCreate, onUpdate, isSaving }: QuestionFormModalProps) {
  const isEditing = Boolean(editing);

  const [label, setLabel] = useState(editing?.label ?? "");
  const [key, setKey] = useState(editing?.key ?? "");
  const [alertWhenYes, setAlertWhenYes] = useState(editing?.alertWhenYes ?? false);
  const [detailRequired, setDetailRequired] = useState(editing?.detailRequiredWhenYes ?? false);
  const [sensitive, setSensitive] = useState(editing?.sensitive ?? false);
  const [active, setActive] = useState(editing?.active ?? true);

  const keyValid = !isEditing ? /^[a-zA-Z][a-zA-Z0-9_]*$/.test(key) : true;
  const canSubmit = label.trim().length > 0 && (isEditing || (key.trim().length > 0 && keyValid));

  function handleSubmit() {
    if (!canSubmit || isSaving) return;
    if (isEditing && editing) {
      onUpdate(editing.id, { label: label.trim(), alertWhenYes, detailRequiredWhenYes: detailRequired, sensitive });
    } else {
      onCreate({
        key: key.trim(),
        label: label.trim(),
        kind: "YES_NO",
        alertWhenYes,
        detailRequiredWhenYes: detailRequired,
        sensitive,
        active,
      });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 p-4">
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6">
        <h2 className="mb-4 text-xl font-semibold text-ink">
          {isEditing ? "Editar pergunta" : "Nova pergunta"}
        </h2>

        <div className="space-y-4">
          {!isEditing && (
            <div>
              <label htmlFor="q-key" className="mb-1.5 block text-sm font-medium text-ink">
                Chave (key)
              </label>
              <input
                id="q-key"
                type="text"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="Ex.: pregnantOrBreastfeeding"
                className="w-full rounded-lg border border-line bg-background px-3 py-2 text-sm text-ink placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              />
              {key && !keyValid && (
                <p className="mt-1 text-xs text-danger">Deve começar com letra, apenas letras, números e _.</p>
              )}
            </div>
          )}

          <div>
            <label htmlFor="q-label" className="mb-1.5 block text-sm font-medium text-ink">
              Texto da pergunta
            </label>
            <input
              id="q-label"
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ex.: Gestante ou lactante?"
              className="w-full rounded-lg border border-line bg-background px-3 py-2 text-sm text-ink placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            />
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={alertWhenYes}
                onChange={(e) => setAlertWhenYes(e.target.checked)}
                className="h-4 w-4 rounded border-line accent-brand"
              />
              <span className="text-sm text-ink">Exibir alerta no cabeçalho quando SIM</span>
            </label>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={detailRequired}
                onChange={(e) => setDetailRequired(e.target.checked)}
                className="h-4 w-4 rounded border-line accent-brand"
              />
              <span className="text-sm text-ink">Exigir detalhamento quando SIM</span>
            </label>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={sensitive}
                onChange={(e) => setSensitive(e.target.checked)}
                className="h-4 w-4 rounded border-line accent-brand"
              />
              <span className="text-sm text-ink">Pergunta sensível</span>
            </label>

            {!isEditing && (
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="h-4 w-4 rounded border-line accent-brand"
                />
                <span className="text-sm text-ink">Ativa imediatamente</span>
              </label>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-lg border border-line px-4 py-2 text-sm text-ink hover:bg-surface-hover"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || isSaving}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90 disabled:opacity-50"
          >
            {isSaving ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
