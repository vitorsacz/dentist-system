import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createMaterialBatchSchema,
  createMaterialSchema,
  type CreateMaterialBatchInput,
  type CreateMaterialInput,
} from "@dentist-system/shared-types";
import { PageHeader } from "@/components/ui/page-header";
import { materialsApi } from "./api";

function BatchForm({ materialId }: { materialId: string }) {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateMaterialBatchInput>({
    resolver: zodResolver(createMaterialBatchSchema),
  });
  const mutation = useMutation({
    mutationFn: (data: CreateMaterialBatchInput) => materialsApi.addBatch(materialId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["materials"] });
      reset();
    },
  });

  return (
    <form
      onSubmit={handleSubmit((data) => mutation.mutate(data))}
      className="flex flex-wrap items-end gap-2 pt-2"
    >
      <div>
        <label className="mb-1 block text-xs text-muted">Quantidade recebida</label>
        <input
          type="number"
          step="0.01"
          className="w-28 rounded-md border border-line px-2 py-1 text-sm"
          {...register("quantity", { valueAsNumber: true })}
        />
        {errors.quantity && <p className="mt-1 text-xs text-bad">{errors.quantity.message}</p>}
      </div>
      <div>
        <label className="mb-1 block text-xs text-muted">Validade</label>
        <input type="date" className="rounded-md border border-line px-2 py-1 text-sm" {...register("expiryDate")} />
      </div>
      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-md border border-line px-3 py-1 text-sm text-accent"
      >
        + lote
      </button>
    </form>
  );
}

export function MaterialsPage() {
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();
  const materialsQuery = useQuery({ queryKey: ["materials"], queryFn: materialsApi.list });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateMaterialInput>({ resolver: zodResolver(createMaterialSchema) });

  const createMutation = useMutation({
    mutationFn: materialsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["materials"] });
      reset();
      setShowForm(false);
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb="Início / Estoque"
        title="Estoque de materiais"
        action={
          <button
            onClick={() => setShowForm((v) => !v)}
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white"
          >
            {showForm ? "Cancelar" : "Novo material"}
          </button>
        }
      />

      {showForm && (
        <form
          onSubmit={handleSubmit((data) => createMutation.mutate(data))}
          className="grid max-w-xl gap-4 rounded-lg border border-line bg-surface p-6 sm:grid-cols-3"
        >
          <div>
            <label className="mb-1 block text-sm text-muted">Nome</label>
            <input className="w-full rounded-md border border-line px-3 py-2 text-sm" {...register("name")} />
            {errors.name && <p className="mt-1 text-sm text-bad">{errors.name.message}</p>}
          </div>
          <div>
            <label className="mb-1 block text-sm text-muted">Unidade</label>
            <input
              placeholder="unidade, ml, caixa..."
              className="w-full rounded-md border border-line px-3 py-2 text-sm"
              {...register("unit")}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-muted">Estoque mínimo</label>
            <input
              type="number"
              step="0.01"
              className="w-full rounded-md border border-line px-3 py-2 text-sm"
              {...register("minimumStock", { valueAsNumber: true })}
            />
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-60 sm:col-span-3"
          >
            Salvar
          </button>
        </form>
      )}

      <div className="space-y-3">
        {materialsQuery.data?.map((material) => (
          <div key={material.id} className="rounded-lg border border-line bg-surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="font-medium text-ink">{material.name}</span>
                <span className="ml-2 text-sm text-muted">
                  {material.currentStock} {material.unit} em estoque (mínimo {material.minimumStock})
                </span>
              </div>
              <div className="flex gap-2">
                {material.lowStock && (
                  <span className="rounded-full bg-bad/10 px-2 py-0.5 text-xs text-bad">estoque baixo</span>
                )}
                {material.expiringSoon && (
                  <span className="rounded-full bg-bad/10 px-2 py-0.5 text-xs text-bad">vencimento próximo</span>
                )}
              </div>
            </div>
            <BatchForm materialId={material.id} />
          </div>
        ))}
      </div>
    </div>
  );
}
