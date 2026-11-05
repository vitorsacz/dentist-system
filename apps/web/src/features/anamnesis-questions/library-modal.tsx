import { AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { LibraryQuestion } from "./api";

interface LibraryModalProps {
  questions: LibraryQuestion[];
  isLoading: boolean;
  onClose: () => void;
}

export function LibraryModal({ questions, isLoading, onClose }: LibraryModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 p-4">
      <div className="flex w-full max-w-lg flex-col rounded-2xl border border-line bg-surface">
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <h2 className="text-lg font-semibold text-ink">Biblioteca de perguntas</h2>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="rounded p-1 text-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            ✕
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-6 py-4">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full rounded" />
              ))}
            </div>
          ) : (
            <ul className="space-y-1">
              {questions.map((q) => (
                <li key={q.key} className="flex items-center gap-2 py-1 text-sm">
                  {q.sensitive && (
                    <AlertTriangle size={12} className="flex-shrink-0 text-warning" aria-label="Sensível" />
                  )}
                  <span className={q.defaultActive ? "text-ink" : "text-muted"}>{q.label}</span>
                  {!q.defaultActive && (
                    <span className="ml-auto text-xs text-muted">inativa por padrão</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-line px-6 py-4">
          <button
            onClick={onClose}
            className="w-full rounded-lg border border-line py-2 text-sm text-ink hover:bg-surface-hover"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
