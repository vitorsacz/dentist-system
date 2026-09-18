import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import type { OrganizationStatus } from "@dentist-system/shared-types";
import { Card } from "@/components/ui/card";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { platformApi } from "./api";

const STATUS_TONE: Record<OrganizationStatus, BadgeTone> = {
  ACTIVE: "success",
  SUSPENDED: "warning",
  DELETED: "neutral",
};

const STATUS_LABEL: Record<OrganizationStatus, string> = {
  ACTIVE: "Ativa",
  SUSPENDED: "Suspensa",
  DELETED: "Excluída",
};

export function OrganizationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const detailQuery = useQuery({
    queryKey: ["platform", "organizations", id],
    queryFn: () => platformApi.getOrganizationDetail(id as string),
    enabled: Boolean(id),
  });

  const org = detailQuery.data;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted">
          <Link to="/platform" className="text-accent">
            Plataforma
          </Link>{" "}
          / {org?.name ?? "Clínica"}
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-ink">{org?.name ?? "Carregando…"}</h1>
      </div>

      {detailQuery.isError && <p className="text-sm text-bad">Organização não encontrada.</p>}

      {org && (
        <Card className="max-w-xl space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted">Tipo</p>
              <p className="text-ink">{org.type}</p>
            </div>
            <div>
              <p className="text-muted">Status</p>
              <Badge tone={STATUS_TONE[org.status]}>{STATUS_LABEL[org.status]}</Badge>
            </div>
            <div>
              <p className="text-muted">Criada em</p>
              <p className="text-ink">{new Date(org.createdAt).toLocaleDateString("pt-BR")}</p>
            </div>
            <div>
              <p className="text-muted">Admin fundador</p>
              {org.foundingAdmin ? (
                <p className="text-ink">
                  {org.foundingAdmin.name}
                  <br />
                  <span className="text-muted">{org.foundingAdmin.email}</span>
                </p>
              ) : (
                <p className="text-muted">Sem admin fundador definido</p>
              )}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
