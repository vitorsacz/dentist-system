import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClinicSchema, type CreateClinicInput } from "@dentist-system/shared-types";
import { PageHeader } from "@/components/ui/page-header";
import { useAuth } from "@/lib/auth-context";
import { can } from "@/lib/access";
import { myClinicApi } from "@/features/my-clinic/api";
import { clinicsApi } from "./api";

export function ClinicsPage() {
  const [showForm, setShowForm] = useState(false);
  const [includeInactive, setIncludeInactive] = useState(false);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = can(user, "users.manage");
  const clinicsQuery = useQuery({
    queryKey: ["clinics", { includeInactive }],
    queryFn: () => clinicsApi.list({ includeInactive }),
  });
  const myClinicQuery = useQuery({ queryKey: ["my-clinic"], queryFn: myClinicApi.get });
  // Consultório de uma clínica é fixo — só tenant tipo Freelancer pode
  // adicionar novos. Enquanto o tipo da organização não carrega, assume
  // restrito (não pisca o botão pra depois sumir).
  const canCreateClinic = myClinicQuery.data ? myClinicQuery.data.type !== "CLINIC" : false;

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateClinicInput>({ resolver: zodResolver(createClinicSchema), defaultValues: { type: "OWN" } });
  const type = watch("type");

  const createMutation = useMutation({
    mutationFn: clinicsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clinics"] });
      reset({ type: "OWN" });
      setShowForm(false);
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => clinicsApi.toggleActive(id, active),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["clinics"] }),
  });

  function handleToggleClinic(id: string, currentActive: boolean) {
    const next = !currentActive;
    const msg = next
      ? "Reativar este consultório?"
      : "Desativar este consultório? Agendamentos existentes não serão cancelados. Deseja continuar?";
    if (confirm(msg)) toggleActiveMutation.mutate({ id, active: next });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb="Início / Consultórios"
        title="Consultórios"
        action={
          canCreateClinic ? (
            <button
              onClick={() => setShowForm((v) => !v)}
              className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white"
            >
              {showForm ? "Cancelar" : "Novo consultório"}
            </button>
          ) : undefined
        }
      />

      {showForm && canCreateClinic && (
        <form
          onSubmit={handleSubmit((data) => createMutation.mutate(data))}
          className="grid max-w-xl gap-4 rounded-lg border border-line bg-surface p-6 sm:grid-cols-2"
        >
          <div>
            <label className="mb-1 block text-sm text-muted">Nome</label>
            <input className="w-full rounded-md border border-line px-3 py-2 text-sm" {...register("name")} />
            {errors.name && <p className="mt-1 text-sm text-bad">{errors.name.message}</p>}
          </div>
          <div>
            <label className="mb-1 block text-sm text-muted">Tipo</label>
            <select className="w-full rounded-md border border-line px-3 py-2 text-sm" {...register("type")}>
              <option value="OWN">Próprio</option>
              <option value="RENTED">Alugado</option>
            </select>
          </div>
          {type === "RENTED" && (
            <div>
              <label className="mb-1 block text-sm text-muted">Valor da diária (R$)</label>
              <input
                type="number"
                step="0.01"
                className="w-full rounded-md border border-line px-3 py-2 text-sm"
                {...register("dailyRentValue", { valueAsNumber: true })}
              />
              {errors.dailyRentValue && (
                <p className="mt-1 text-sm text-bad">{errors.dailyRentValue.message}</p>
              )}
            </div>
          )}
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-60 sm:col-span-2"
          >
            Salvar
          </button>
        </form>
      )}

      {isAdmin && (
        <label className="flex items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(e) => setIncludeInactive(e.target.checked)}
            className="rounded"
          />
          Mostrar inativos
        </label>
      )}

      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-muted">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Diária</th>
              <th className="px-4 py-3">Status</th>
              {isAdmin && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {clinicsQuery.data?.map((clinic) => (
              <tr key={clinic.id} className={!clinic.active ? "opacity-60" : undefined}>
                <td className="px-4 py-3">{clinic.name}</td>
                <td className="px-4 py-3">{clinic.type === "OWN" ? "Próprio" : "Alugado"}</td>
                <td className="px-4 py-3 tabular">
                  {clinic.dailyRentValue ? `R$ ${clinic.dailyRentValue.toFixed(2)}` : "—"}
                </td>
                <td className="px-4 py-3">
                  {clinic.active ? (
                    <span className="rounded-full bg-good/10 px-2 py-0.5 text-xs text-good">Ativo</span>
                  ) : (
                    <span className="rounded-full bg-bad/10 px-2 py-0.5 text-xs text-bad">Inativo</span>
                  )}
                </td>
                {isAdmin && (
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      disabled={toggleActiveMutation.isPending}
                      onClick={() => handleToggleClinic(clinic.id, clinic.active)}
                      className="text-xs text-muted hover:text-ink disabled:opacity-60"
                    >
                      {clinic.active ? "Desativar" : "Reativar"}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
