import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { ApiError } from "./api-client";

interface Props<T> {
  query: UseQueryResult<T>;
  children: (data: NonNullable<T>) => ReactNode;
}

export function QueryStateWrapper<T>({ query, children }: Props<T>) {
  if (query.isPending) {
    return <p className="p-4 text-sm text-muted">Carregando...</p>;
  }
  if (query.error) {
    const status = query.error instanceof ApiError ? query.error.status : 0;
    if (status === 404) return <p className="p-4 text-sm text-muted">Dados não encontrados.</p>;
    if (status === 403) return <p className="p-4 text-sm text-muted">Sem permissão de acesso.</p>;
    return <p className="p-4 text-sm text-bad">Erro ao carregar dados.</p>;
  }
  if (!query.data) return null;
  return <>{children(query.data as NonNullable<T>)}</>;
}
