import { useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Pencil, Trash2, AlertTriangle, BookOpen } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useAnamnesisQuestions,
  useAnamnesisLibrary,
  useSeedLibrary,
  useCreateAnamnesisQuestion,
  useUpdateAnamnesisQuestion,
  useToggleAnamnesisQuestion,
  useSoftDeleteAnamnesisQuestion,
  useReorderAnamnesisQuestions,
  type AnamnesisQuestion,
} from "./api";
import { QuestionFormModal } from "./question-form-modal";
import { LibraryModal } from "./library-modal";

// ─── Sortable card ────────────────────────────────────────────────────────────

interface CardProps {
  question: AnamnesisQuestion;
  onEdit: (q: AnamnesisQuestion) => void;
  onToggle: (q: AnamnesisQuestion) => void;
  onDelete: (q: AnamnesisQuestion) => void;
  isTogglingId: string | null;
  isDeletingId: string | null;
}

function QuestionCard({ question, onEdit, onToggle, onDelete, isTogglingId, isDeletingId }: CardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: question.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3"
    >
      {/* drag handle */}
      <button
        {...attributes}
        {...listeners}
        aria-label="Arrastar para reordenar"
        className="flex-shrink-0 cursor-grab text-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand active:cursor-grabbing"
      >
        <GripVertical size={16} />
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`text-sm font-medium ${question.active ? "text-ink" : "text-muted line-through"}`}>
            {question.label}
          </span>
          {question.sensitive && (
            <Badge tone="warning">
              <span className="flex items-center gap-1">
                <AlertTriangle size={10} />
                Sensível
              </span>
            </Badge>
          )}
          {question.alertWhenYes && (
            <Badge tone="error">Alerta</Badge>
          )}
          {!question.active && (
            <Badge tone="neutral">Inativa</Badge>
          )}
        </div>
        <span className="text-xs text-muted">{question.key}</span>
      </div>

      <div className="flex flex-shrink-0 items-center gap-2">
        {/* toggle */}
        <button
          onClick={() => onToggle(question)}
          disabled={isTogglingId === question.id}
          aria-label={question.active ? "Desativar pergunta" : "Ativar pergunta"}
          className="rounded px-2 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50"
        >
          {question.active ? (
            <span className="text-muted hover:text-ink">Desativar</span>
          ) : (
            <span className="text-brand hover:text-brand/80">Ativar</span>
          )}
        </button>

        {/* edit */}
        <button
          onClick={() => onEdit(question)}
          aria-label="Editar pergunta"
          className="rounded p-1.5 text-muted hover:bg-surface-hover hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <Pencil size={14} />
        </button>

        {/* delete */}
        <button
          onClick={() => onDelete(question)}
          disabled={isDeletingId === question.id}
          aria-label="Excluir pergunta"
          className="rounded p-1.5 text-muted hover:bg-surface-hover hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

// ─── Delete confirm modal ─────────────────────────────────────────────────────

function DeleteConfirmModal({
  question,
  onConfirm,
  onCancel,
  isDeleting,
}: {
  question: AnamnesisQuestion;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-6">
        <h2 className="mb-2 text-lg font-semibold text-ink">Excluir pergunta</h2>
        <p className="mb-6 text-sm text-muted">
          Excluir <strong className="text-ink">{question.label}</strong>? Respostas existentes não serão
          alteradas.
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded-lg border border-line px-4 py-2 text-sm text-ink hover:bg-surface-hover"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="rounded-lg bg-danger px-4 py-2 text-sm font-medium text-white hover:bg-danger/90 disabled:opacity-50"
          >
            {isDeleting ? "Excluindo…" : "Excluir"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function AnamnesisQuestionsPage() {
  const { data: questions = [], isLoading } = useAnamnesisQuestions();
  const libraryQuery = useAnamnesisLibrary();
  const seedMutation = useSeedLibrary();
  const createMutation = useCreateAnamnesisQuestion();
  const updateMutation = useUpdateAnamnesisQuestion();
  const toggleMutation = useToggleAnamnesisQuestion();
  const deleteMutation = useSoftDeleteAnamnesisQuestion();
  const reorderMutation = useReorderAnamnesisQuestions();

  const [localOrder, setLocalOrder] = useState<string[] | null>(null);
  const [formModal, setFormModal] = useState<{ open: boolean; editing: AnamnesisQuestion | null }>({
    open: false,
    editing: null,
  });
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AnamnesisQuestion | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const orderedQuestions = (() => {
    if (!localOrder) return questions;
    const byId = new Map(questions.map((q) => [q.id, q]));
    return localOrder.map((id) => byId.get(id)).filter(Boolean) as AnamnesisQuestion[];
  })();

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIds = orderedQuestions.map((q) => q.id);
    const oldIndex = oldIds.indexOf(active.id as string);
    const newIndex = oldIds.indexOf(over.id as string);
    const newIds = arrayMove(oldIds, oldIndex, newIndex);

    setLocalOrder(newIds);
    reorderMutation.mutate(newIds, { onSettled: () => setLocalOrder(null) });
  }

  function handleToggle(q: AnamnesisQuestion) {
    setTogglingId(q.id);
    toggleMutation.mutate(q.id, { onSettled: () => setTogglingId(null) });
  }

  function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setDeletingId(deleteTarget.id);
    deleteMutation.mutate(deleteTarget.id, {
      onSettled: () => {
        setDeletingId(null);
        setDeleteTarget(null);
      },
    });
  }

  function handleSeed() {
    seedMutation.mutate();
  }

  function handleOpenLibrary() {
    setLibraryOpen(true);
    libraryQuery.refetch();
  }

  return (
    <div className="p-6">
      <PageHeader
        breadcrumb="Configurações"
        title="Anamnese"
        action={
          <div className="flex gap-2">
            <button
              onClick={handleOpenLibrary}
              className="flex items-center gap-2 rounded-lg border border-line px-4 py-2 text-sm text-ink hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <BookOpen size={16} />
              Biblioteca
            </button>
            <button
              onClick={handleSeed}
              disabled={seedMutation.isPending}
              className="flex items-center gap-2 rounded-lg border border-line px-4 py-2 text-sm text-ink hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50"
            >
              {seedMutation.isPending ? "Carregando…" : "Carregar biblioteca"}
            </button>
            <button
              onClick={() => setFormModal({ open: true, editing: null })}
              className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <Plus size={16} />
              Adicionar pergunta
            </button>
          </div>
        }
      />

      {isLoading ? (
        <div className="mt-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : orderedQuestions.length === 0 ? (
        <div className="mt-12 flex flex-col items-center gap-3 text-center text-muted">
          <p className="text-sm">Nenhuma pergunta configurada.</p>
          <p className="text-xs">Use "Carregar biblioteca" para importar as perguntas padrão.</p>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={orderedQuestions.map((q) => q.id)} strategy={verticalListSortingStrategy}>
            <div className="mt-4 space-y-2">
              {orderedQuestions.map((q) => (
                <QuestionCard
                  key={q.id}
                  question={q}
                  onEdit={(q) => setFormModal({ open: true, editing: q })}
                  onToggle={handleToggle}
                  onDelete={setDeleteTarget}
                  isTogglingId={togglingId}
                  isDeletingId={deletingId}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {formModal.open && (
        <QuestionFormModal
          editing={formModal.editing}
          onClose={() => setFormModal({ open: false, editing: null })}
          onCreate={(input) =>
            createMutation.mutate(input, {
              onSuccess: () => setFormModal({ open: false, editing: null }),
            })
          }
          onUpdate={(id, input) =>
            updateMutation.mutate(
              { id, input },
              { onSuccess: () => setFormModal({ open: false, editing: null }) },
            )
          }
          isSaving={createMutation.isPending || updateMutation.isPending}
        />
      )}

      {libraryOpen && (
        <LibraryModal
          questions={libraryQuery.data ?? []}
          isLoading={libraryQuery.isFetching}
          onClose={() => setLibraryOpen(false)}
        />
      )}

      {deleteTarget && (
        <DeleteConfirmModal
          question={deleteTarget}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
          isDeleting={deletingId === deleteTarget.id}
        />
      )}
    </div>
  );
}
