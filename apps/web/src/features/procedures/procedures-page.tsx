import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createProcedureSchema, type CreateProcedureInput } from "@dentist-system/shared-types";
import { proceduresApi } from "./api";

export function ProceduresPage() {
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();
  const proceduresQuery = useQuery({ queryKey: ["procedures"], queryFn: proceduresApi.list });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateProcedureInput>({
    resolver: zodResolver(createProcedureSchema),
    defaultValues: { active: true },
  });

  const createMutation = useMutation({
    mutationFn: proceduresApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["procedures"] });
      reset({ active: true, name: "", defaultValue: undefined });
      setShowForm(false);
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => proceduresApi.update(id, { active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["procedures"] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-ink">Tabela de procedimentos</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white"
        >
          {showForm ? "Cancelar" : "Novo procedimento"}
        </button>
      </div>

      {showForm && (
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
            <label className="mb-1 block text-sm text-muted">Valor padrão (R$)</label>
            <input
              type="number"
              step="0.01"
              className="w-full rounded-md border border-line px-3 py-2 text-sm"
              {...register("defaultValue", { valueAsNumber: true })}
            />
            {errors.defaultValue && <p className="mt-1 text-sm text-bad">{errors.defaultValue.message}</p>}
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-60 sm:col-span-2"
          >
            Salvar
          </button>
        </form>
      )}

      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-muted">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Valor padrão</th>
              <th className="px-4 py-3">Ativo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {proceduresQuery.data?.map((procedure) => (
              <tr key={procedure.id}>
                <td className="px-4 py-3">{procedure.name}</td>
                <td className="px-4 py-3 tabular">R$ {procedure.defaultValue.toFixed(2)}</td>
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={procedure.active}
                    onChange={(e) =>
                      toggleActiveMutation.mutate({ id: procedure.id, active: e.target.checked })
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
