import { useQuery } from "@tanstack/react-query";
import type { Role } from "@dentist-system/shared-types";
import { myClinicApi } from "./api";

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Admin",
  DENTIST: "Dentista",
  RECEPTIONIST: "Recepcionista",
};

export function MyClinicPage() {
  const myClinicQuery = useQuery({ queryKey: ["my-clinic"], queryFn: myClinicApi.get });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-ink">
        {myClinicQuery.data?.name ?? "Minha Clínica"}
      </h1>

      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-muted">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Papel</th>
              <th className="px-4 py-3">Ativo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {myClinicQuery.data?.members.map((member) => (
              <tr key={member.membershipId}>
                <td className="px-4 py-3">{member.name}</td>
                <td className="px-4 py-3">{ROLE_LABELS[member.role]}</td>
                <td className="px-4 py-3">{member.active ? "Sim" : "Não"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {myClinicQuery.data?.members.length === 0 && (
          <p className="p-4 text-sm text-muted">Nenhum membro cadastrado ainda.</p>
        )}
      </div>
    </div>
  );
}
