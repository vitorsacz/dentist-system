import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createOrganizationSchema, type CreateOrganizationInput } from "@dentist-system/shared-types";
import { platformApi } from "./api";

export function PlatformPage() {
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();
  const organizationsQuery = useQuery({ queryKey: ["platform", "organizations"], queryFn: platformApi.listOrganizations });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateOrganizationInput>({ resolver: zodResolver(createOrganizationSchema) });

  const createMutation = useMutation({
    mutationFn: platformApi.createOrganization,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform", "organizations"] });
      reset();
      setShowForm(false);
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-ink">Plataforma</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white"
        >
          {showForm ? "Cancelar" : "Nova clínica"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit((data) => createMutation.mutate(data))}
          className="grid max-w-xl gap-4 rounded-lg border border-line bg-surface p-6 sm:grid-cols-2"
        >
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm text-muted">Nome da clínica</label>
            <input className="w-full rounded-md border border-line px-3 py-2 text-sm" {...register("name")} />
            {errors.name && <p className="mt-1 text-sm text-bad">{errors.name.message}</p>}
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm text-muted">Nome do admin fundador</label>
            <input
              className="w-full rounded-md border border-line px-3 py-2 text-sm"
              {...register("foundingAdminName")}
            />
            {errors.foundingAdminName && (
              <p className="mt-1 text-sm text-bad">{errors.foundingAdminName.message}</p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-sm text-muted">E-mail do admin fundador</label>
            <input
              type="email"
              className="w-full rounded-md border border-line px-3 py-2 text-sm"
              {...register("foundingAdminEmail")}
            />
            {errors.foundingAdminEmail && (
              <p className="mt-1 text-sm text-bad">{errors.foundingAdminEmail.message}</p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-sm text-muted">Senha inicial</label>
            <input
              type="password"
              className="w-full rounded-md border border-line px-3 py-2 text-sm"
              {...register("foundingAdminPassword")}
            />
            {errors.foundingAdminPassword && (
              <p className="mt-1 text-sm text-bad">{errors.foundingAdminPassword.message}</p>
            )}
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-60 sm:col-span-2"
          >
            Criar clínica
          </button>
        </form>
      )}

      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-muted">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Criada em</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {organizationsQuery.data?.map((org) => (
              <tr key={org.id}>
                <td className="px-4 py-3">{org.name}</td>
                <td className="px-4 py-3">{org.type}</td>
                <td className="px-4 py-3">{org.status}</td>
                <td className="px-4 py-3">{new Date(org.createdAt).toLocaleDateString("pt-BR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {organizationsQuery.data?.length === 0 && (
          <p className="p-4 text-sm text-muted">Nenhuma clínica cadastrada ainda.</p>
        )}
      </div>
    </div>
  );
}
