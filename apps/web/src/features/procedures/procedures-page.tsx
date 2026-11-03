import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { can } from "@/lib/access";
import { useAuth } from "@/lib/auth-context";
import { ProcedureFormModal } from "./procedure-form-modal";
import { type Procedure, useProcedures, useCreateProcedure, useUpdateProcedure, useSoftDeleteProcedure } from "./api";

const PAGE_SIZE = 8;

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function ProceduresPage() {
  const { user } = useAuth();
  const canWrite = can(user, "procedures.write");

  const { data: procedures = [], isLoading } = useProcedures();
  const createMutation = useCreateProcedure();
  const updateMutation = useUpdateProcedure();
  const softDeleteMutation = useSoftDeleteProcedure();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [page, setPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingProcedure, setEditingProcedure] = useState<Procedure | null>(null);

  const filtered = useMemo(() => {
    return procedures.filter((p) => {
      if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (statusFilter === "active" && !p.active) return false;
      if (statusFilter === "inactive" && p.active) return false;
      return true;
    });
  }, [procedures, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function openCreate() {
    setEditingProcedure(null);
    setModalOpen(true);
  }

  function openEdit(procedure: Procedure) {
    setEditingProcedure(procedure);
    setModalOpen(true);
  }

  function handleSave(input: { name: string; defaultValue: number; active: boolean }) {
    if (editingProcedure) {
      updateMutation.mutate({ id: editingProcedure.id, input }, { onSuccess: () => setModalOpen(false) });
    } else {
      createMutation.mutate(input, { onSuccess: () => setModalOpen(false) });
    }
  }

  function handleToggleActive(procedure: Procedure) {
    if (procedure.active) {
      softDeleteMutation.mutate(procedure.id);
    } else {
      updateMutation.mutate({ id: procedure.id, input: { active: true } });
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb="Início / Procedimentos"
        title="Procedimentos"
        action={
          canWrite ? (
            <button
              onClick={openCreate}
              className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white"
            >
              <Plus className="h-4 w-4" />
              Novo procedimento
            </button>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Buscar por nome..."
            className="w-64 rounded-lg border border-line py-2 pl-9 pr-3 text-sm text-ink placeholder:text-muted"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value as typeof statusFilter); setPage(1); }}
          className="rounded-lg border border-line px-3 py-2 text-sm text-ink"
        >
          <option value="all">Todos os status</option>
          <option value="active">Ativo</option>
          <option value="inactive">Inativo</option>
        </select>
      </div>

      {isLoading ? (
        <Skeleton className="h-96" />
      ) : procedures.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-line bg-surface py-16 text-center">
          <p className="text-sm text-muted">Nenhum procedimento cadastrado ainda.</p>
          {canWrite && (
            <button
              onClick={openCreate}
              className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white"
            >
              Cadastre seu primeiro procedimento
            </button>
          )}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface py-16 text-center">
          <p className="text-sm text-muted">Nenhum procedimento encontrado com esses filtros.</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-line bg-surface">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line text-muted">
                <tr>
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">Valor padrão</th>
                  <th className="px-4 py-3">Status</th>
                  {canWrite && <th className="px-4 py-3">Ações</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {paged.map((procedure) => (
                  <tr key={procedure.id}>
                    <td className="px-4 py-3 font-medium text-ink">{procedure.name}</td>
                    <td className="px-4 py-3 tabular">{formatCurrency(procedure.defaultValue)}</td>
                    <td className="px-4 py-3">
                      <Badge tone={procedure.active ? "success" : "neutral"}>
                        {procedure.active ? "Ativo" : "Inativo"}
                      </Badge>
                    </td>
                    {canWrite && (
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <button onClick={() => openEdit(procedure)} className="text-sm text-accent">
                            Editar
                          </button>
                          <button
                            onClick={() => handleToggleActive(procedure)}
                            disabled={softDeleteMutation.isPending || updateMutation.isPending}
                            className="text-sm text-muted disabled:opacity-50"
                          >
                            {procedure.active ? "Desativar" : "Reativar"}
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-muted">
              <span>
                Página {page} de {totalPages} — {filtered.length} procedimento(s)
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="rounded-lg border border-line px-3 py-1.5 text-ink disabled:opacity-50"
                >
                  Anterior
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="rounded-lg border border-line px-3 py-1.5 text-ink disabled:opacity-50"
                >
                  Próxima
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {modalOpen && (
        <ProcedureFormModal
          editingProcedure={editingProcedure}
          onClose={() => setModalOpen(false)}
          onSave={handleSave}
          isSaving={isSaving}
        />
      )}
    </div>
  );
}
