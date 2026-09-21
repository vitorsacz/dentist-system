import { useEffect, useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { paletteColorForIndex, PALETTE_COLOR_HEX } from "@/lib/palette-colors";
import { ProcedureFormModal } from "./procedure-form-modal";
import { useMockProcedureCatalog, type CatalogProcedure, type ProcedureCategory } from "./mock-data";

const PAGE_SIZE = 8;

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function CategoryBadge({ category, index }: { category: ProcedureCategory | undefined; index: number }) {
  const color = PALETTE_COLOR_HEX[paletteColorForIndex(index)];
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{ backgroundColor: color.light, color: color.solid }}
    >
      {category?.name ?? "—"}
    </span>
  );
}

export function ProceduresPage() {
  const { data, isLoading } = useMockProcedureCatalog();

  const [categories, setCategories] = useState<ProcedureCategory[]>([]);
  const [procedures, setProcedures] = useState<CatalogProcedure[]>([]);
  useEffect(() => {
    if (data) {
      setCategories(data.categories);
      setProcedures(data.procedures);
    }
  }, [data]);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [page, setPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingProcedure, setEditingProcedure] = useState<CatalogProcedure | null>(null);

  const categoryIndexById = useMemo(() => {
    const map = new Map<string, number>();
    categories.forEach((category, index) => map.set(category.id, index));
    return map;
  }, [categories]);
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const filteredProcedures = useMemo(() => {
    return procedures.filter((procedure) => {
      if (search && !procedure.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (categoryFilter !== "all" && procedure.categoryId !== categoryFilter) return false;
      if (statusFilter !== "all" && procedure.status !== statusFilter) return false;
      return true;
    });
  }, [procedures, search, categoryFilter, statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [search, categoryFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredProcedures.length / PAGE_SIZE));
  const pagedProcedures = filteredProcedures.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function openCreateModal() {
    setEditingProcedure(null);
    setModalOpen(true);
  }

  function openEditModal(procedure: CatalogProcedure) {
    setEditingProcedure(procedure);
    setModalOpen(true);
  }

  function handleSave(procedure: CatalogProcedure) {
    setProcedures((prev) => {
      const exists = prev.some((p) => p.id === procedure.id);
      return exists ? prev.map((p) => (p.id === procedure.id ? procedure : p)) : [...prev, procedure];
    });
    setModalOpen(false);
  }

  function handleAddCategory(category: ProcedureCategory) {
    setCategories((prev) => (prev.some((c) => c.id === category.id) ? prev : [...prev, category]));
  }

  function toggleStatus(procedure: CatalogProcedure) {
    setProcedures((prev) =>
      prev.map((p) => (p.id === procedure.id ? { ...p, status: p.status === "active" ? "inactive" : "active" } : p)),
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb="Início / Procedimentos"
        title="Procedimentos"
        action={
          <button
            onClick={openCreateModal}
            className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white"
          >
            <Plus className="h-4 w-4" />
            Novo procedimento
          </button>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome..."
            className="w-64 rounded-lg border border-line py-2 pl-9 pr-3 text-sm text-ink placeholder:text-muted"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-lg border border-line px-3 py-2 text-sm text-ink"
        >
          <option value="all">Todas as categorias</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
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
          <button
            onClick={openCreateModal}
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white"
          >
            Cadastre seu primeiro procedimento
          </button>
        </div>
      ) : filteredProcedures.length === 0 ? (
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
                  <th className="px-4 py-3">Categoria</th>
                  <th className="px-4 py-3">Duração média</th>
                  <th className="px-4 py-3">Preço base</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {pagedProcedures.map((procedure) => (
                  <tr key={procedure.id}>
                    <td className="px-4 py-3 font-medium text-ink">{procedure.name}</td>
                    <td className="px-4 py-3">
                      <CategoryBadge
                        category={categoryById.get(procedure.categoryId)}
                        index={categoryIndexById.get(procedure.categoryId) ?? 0}
                      />
                    </td>
                    <td className="px-4 py-3 tabular">{procedure.estimatedDurationMinutes} min</td>
                    <td className="px-4 py-3 tabular">{formatCurrency(procedure.basePrice)}</td>
                    <td className="px-4 py-3">
                      <Badge tone={procedure.status === "active" ? "success" : "neutral"}>
                        {procedure.status === "active" ? "Ativo" : "Inativo"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <button onClick={() => openEditModal(procedure)} className="text-sm text-accent">
                          Editar
                        </button>
                        <button onClick={() => toggleStatus(procedure)} className="text-sm text-muted">
                          {procedure.status === "active" ? "Desativar" : "Reativar"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-muted">
              <span>
                Página {page} de {totalPages} — {filteredProcedures.length} procedimento(s)
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
          categories={categories}
          editingProcedure={editingProcedure}
          onClose={() => setModalOpen(false)}
          onSave={handleSave}
          onAddCategory={handleAddCategory}
        />
      )}
    </div>
  );
}
