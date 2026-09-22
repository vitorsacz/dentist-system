import { useState } from "react";
import type { CatalogProcedure, ProcedureCategory } from "./mock-data";

const NEW_CATEGORY_VALUE = "__new__";

function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || `categoria-${Date.now()}`
  );
}

interface ProcedureFormModalProps {
  categories: ProcedureCategory[];
  editingProcedure?: CatalogProcedure | null;
  onClose: () => void;
  onSave: (procedure: CatalogProcedure) => void;
  onAddCategory: (category: ProcedureCategory) => void;
}

export function ProcedureFormModal({
  categories,
  editingProcedure,
  onClose,
  onSave,
  onAddCategory,
}: ProcedureFormModalProps) {
  const isEditing = Boolean(editingProcedure);

  const [name, setName] = useState(editingProcedure?.name ?? "");
  const [categoryId, setCategoryId] = useState(editingProcedure?.categoryId ?? categories[0]?.id ?? "");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [duration, setDuration] = useState(String(editingProcedure?.estimatedDurationMinutes ?? ""));
  const [price, setPrice] = useState(String(editingProcedure?.basePrice ?? ""));
  const [description, setDescription] = useState(editingProcedure?.description ?? "");
  const [active, setActive] = useState(editingProcedure ? editingProcedure.status === "active" : true);

  const isNewCategory = categoryId === NEW_CATEGORY_VALUE;
  const durationValue = Number(duration);
  const priceValue = Number(price);
  const canSubmit =
    name.trim().length > 0 &&
    (isNewCategory ? newCategoryName.trim().length > 0 : categoryId.length > 0) &&
    durationValue > 0 &&
    priceValue >= 0;

  function handleSubmit() {
    if (!canSubmit) return;

    let finalCategoryId = categoryId;
    if (isNewCategory) {
      finalCategoryId = slugify(newCategoryName);
      onAddCategory({ id: finalCategoryId, name: newCategoryName.trim() });
    }

    onSave({
      id: editingProcedure?.id ?? `proc-manual-${Date.now()}`,
      name: name.trim(),
      categoryId: finalCategoryId,
      estimatedDurationMinutes: durationValue,
      basePrice: priceValue,
      description: description.trim() || undefined,
      status: active ? "active" : "inactive",
      createdAt: editingProcedure?.createdAt ?? new Date().toISOString(),
    });
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
            <label className="mb-1.5 block text-sm font-medium text-ink">Categoria</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full rounded-lg border border-line px-3 py-2 text-sm text-ink"
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
              <option value={NEW_CATEGORY_VALUE}>+ Nova categoria...</option>
            </select>
            {isNewCategory && (
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Nome da nova categoria"
                className="mt-2 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink placeholder:text-muted"
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink">Duração estimada (min)</label>
              <input
                type="number"
                min={0}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="w-full rounded-lg border border-line px-3 py-2 text-sm text-ink"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink">Preço base (R$)</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full rounded-lg border border-line px-3 py-2 text-sm text-ink"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink">Descrição (opcional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-line px-3 py-2 text-sm text-ink placeholder:text-muted"
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
            className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {isEditing ? "Salvar alterações" : "Adicionar procedimento"}
          </button>
        </div>
      </div>
    </div>
  );
}
