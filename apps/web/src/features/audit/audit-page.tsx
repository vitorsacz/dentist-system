import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ApiError } from "@/lib/api-client";
import { PageHeader } from "@/components/ui/page-header";
import { auditApi, type AuditFilters } from "./api";

const PAGE_SIZE = 50;

const ACTION_LABELS: Record<string, string> = {
  LOGIN: "Login",
  LOGIN_FAILURE: "Falha de login",
  LOGOUT: "Logout",
  PATIENT_CREATE: "Criação de paciente",
  PATIENT_UPDATE: "Edição de paciente",
  CLINICAL_RECORD_READ: "Acesso ao prontuário",
  CLINICAL_RECORD_CREATE: "Novo prontuário",
  ANAMNESIS_READ: "Acesso à anamnese",
  ANAMNESIS_UPSERT: "Edição de anamnese",
  ODONTOGRAM_READ: "Acesso ao odontograma",
  ATTENDANCE_CREATE: "Criação de atendimento",
  CLINIC_FINANCIAL_TERMS_UPSERT: "Edição de termos financeiros",
  USER_UPDATE: "Atualização de usuário",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AuditPage() {
  const [filters, setFilters] = useState<AuditFilters>({ pageSize: PAGE_SIZE, page: 1 });
  const [draftFilters, setDraftFilters] = useState({ userId: "", action: "", from: "", to: "" });

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["audit", filters],
    queryFn: () => auditApi.list(filters),
  });

  const is403 = isError && error instanceof ApiError && error.status === 403;

  function applyFilters() {
    setFilters({
      ...draftFilters,
      userId: draftFilters.userId || undefined,
      action: draftFilters.action || undefined,
      from: draftFilters.from || undefined,
      to: draftFilters.to || undefined,
      page: 1,
      pageSize: PAGE_SIZE,
    });
  }

  function clearFilters() {
    setDraftFilters({ userId: "", action: "", from: "", to: "" });
    setFilters({ page: 1, pageSize: PAGE_SIZE });
  }

  if (is403) {
    return (
      <div className="p-6">
        <PageHeader breadcrumb="Auditoria" title="Registro de Auditoria" />
        <p className="mt-4 text-muted-foreground">Acesso negado. Apenas administradores e donos de consultório podem ver o registro de auditoria.</p>
      </div>
    );
  }

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;

  return (
    <div className="p-6 space-y-4">
      <PageHeader breadcrumb="Auditoria" title="Registro de Auditoria" />

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">ID do usuário</label>
          <input
            type="text"
            className="border rounded px-2 py-1 text-sm w-52"
            placeholder="cuid do usuário"
            value={draftFilters.userId}
            onChange={(e) => setDraftFilters((d) => ({ ...d, userId: e.target.value }))}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Ação</label>
          <select
            className="border rounded px-2 py-1 text-sm"
            value={draftFilters.action}
            onChange={(e) => setDraftFilters((d) => ({ ...d, action: e.target.value }))}
          >
            <option value="">Todas</option>
            {Object.entries(ACTION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">De</label>
          <input
            type="date"
            className="border rounded px-2 py-1 text-sm"
            value={draftFilters.from}
            onChange={(e) => setDraftFilters((d) => ({ ...d, from: e.target.value }))}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Até</label>
          <input
            type="date"
            className="border rounded px-2 py-1 text-sm"
            value={draftFilters.to}
            onChange={(e) => setDraftFilters((d) => ({ ...d, to: e.target.value }))}
          />
        </div>
        <button
          className="px-3 py-1 rounded bg-primary text-primary-foreground text-sm font-medium"
          onClick={applyFilters}
        >
          Filtrar
        </button>
        <button
          className="px-3 py-1 rounded border text-sm"
          onClick={clearFilters}
        >
          Limpar
        </button>
      </div>

      {/* Tabela */}
      {isLoading && <p className="text-muted-foreground text-sm">Carregando…</p>}
      {isError && !is403 && <p className="text-destructive text-sm">Erro ao carregar registros.</p>}

      {data && (
        <>
          <p className="text-xs text-muted-foreground">
            {data.total} registro{data.total !== 1 ? "s" : ""} encontrado{data.total !== 1 ? "s" : ""}
          </p>
          <div className="overflow-x-auto rounded border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Data/hora</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Ação</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Entidade</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">ID entidade</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Usuário</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">IP</th>
                </tr>
              </thead>
              <tbody>
                {data.items.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-4 text-center text-muted-foreground">
                      Nenhum registro encontrado.
                    </td>
                  </tr>
                )}
                {data.items.map((item) => (
                  <tr key={item.id} className="border-t hover:bg-muted/30">
                    <td className="px-3 py-2 whitespace-nowrap text-xs">{formatDate(item.createdAt)}</td>
                    <td className="px-3 py-2">
                      <span className="font-mono text-xs bg-muted px-1 rounded">
                        {ACTION_LABELS[item.action] ?? item.action}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{item.entity ?? "—"}</td>
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                      {item.entityId ? item.entityId.slice(0, 8) + "…" : "—"}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                      {item.userId ? item.userId.slice(0, 8) + "…" : "—"}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{item.ip ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="flex items-center gap-2 justify-end">
              <button
                className="px-2 py-1 rounded border text-sm disabled:opacity-40"
                disabled={filters.page === 1}
                onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) - 1 }))}
              >
                ← Anterior
              </button>
              <span className="text-sm text-muted-foreground">
                {filters.page} / {totalPages}
              </span>
              <button
                className="px-2 py-1 rounded border text-sm disabled:opacity-40"
                disabled={filters.page === totalPages}
                onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) + 1 }))}
              >
                Próxima →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
