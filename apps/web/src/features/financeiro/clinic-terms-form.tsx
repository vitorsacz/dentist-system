import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  upsertClinicFinancialTermsSchema,
  type UpsertClinicFinancialTermsInput,
} from "@dentist-system/shared-types";
import { clinicTermsApi } from "./api";
import { clinicsApi } from "@/features/clinics/api";

export function ClinicTermsForm() {
  const queryClient = useQueryClient();
  const clinicsQuery = useQuery({ queryKey: ["clinics"], queryFn: () => clinicsApi.list() });

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UpsertClinicFinancialTermsInput>({
    resolver: zodResolver(upsertClinicFinancialTermsSchema),
    defaultValues: { relationshipType: "RENTED_FIXED" },
  });

  const clinicId = watch("clinicId" as never) as string | undefined;
  const relationshipType = watch("relationshipType");

  const termsQuery = useQuery({
    queryKey: ["clinic-terms", clinicId],
    queryFn: () => clinicTermsApi.get(clinicId!),
    enabled: Boolean(clinicId),
  });

  // Preenche o formulário quando os termos existentes carregam
  useEffect(() => {
    if (!termsQuery.data) return;
    const t = termsQuery.data;
    const base = { ownerLabel: t.ownerLabel ?? undefined };
    if (t.relationshipType === "RENTED_FIXED") {
      reset({
        relationshipType: "RENTED_FIXED",
        rentValue: t.rentValue ?? 0,
        rentPeriodicity: t.rentPeriodicity ?? "DAILY",
        ...base,
      });
    } else if (t.relationshipType === "COMMISSION") {
      reset({ relationshipType: "COMMISSION", commissionPercentage: t.commissionPercentage ?? 0, ...base });
    } else if (t.relationshipType === "PER_SERVICE") {
      reset({ relationshipType: "PER_SERVICE", defaultServiceRate: t.defaultServiceRate ?? 0, ...base });
    }
  }, [termsQuery.data, reset]);

  const mutation = useMutation({
    mutationFn: (data: UpsertClinicFinancialTermsInput) => clinicTermsApi.upsert(clinicId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clinic-terms", clinicId] });
    },
  });

  return (
    <div className="space-y-4">
      {/* Seletor de consultório */}
      <div className="max-w-sm">
        <label className="mb-1 block text-sm text-muted">Consultório</label>
        <select
          className="w-full rounded-md border border-line px-3 py-2 text-sm"
          {...(register as (name: string) => object)("clinicId")}
        >
          <option value="">Selecione um consultório</option>
          {clinicsQuery.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {!clinicId && (
        <p className="text-sm text-muted">Selecione um consultório para ver ou editar os termos.</p>
      )}

      {clinicId && termsQuery.isLoading && (
        <p className="text-sm text-muted">Carregando termos…</p>
      )}

      {clinicId && !termsQuery.isLoading && (
        <form
          onSubmit={handleSubmit((data) => mutation.mutate(data))}
          className="grid max-w-2xl gap-4 rounded-lg border border-line bg-surface p-6 sm:grid-cols-2"
        >
          {!termsQuery.data && (
            <p className="rounded-md bg-warning/10 px-3 py-2 text-sm text-warning sm:col-span-2">
              Nenhum termo cadastrado para este consultório. Preencha abaixo para definir.
            </p>
          )}

          {/* Tipo de relação */}
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm text-muted">Tipo de relação</label>
            <select
              className="w-full rounded-md border border-line px-3 py-2 text-sm"
              {...register("relationshipType")}
              onChange={() => {
                const type = watch("relationshipType");
                if (type === "RENTED_FIXED") reset({ relationshipType: "RENTED_FIXED", rentValue: 0, rentPeriodicity: "DAILY" });
                else if (type === "COMMISSION") reset({ relationshipType: "COMMISSION", commissionPercentage: 0 });
                else reset({ relationshipType: "PER_SERVICE", defaultServiceRate: 0 });
              }}
            >
              <option value="RENTED_FIXED">Aluguel fixo</option>
              <option value="COMMISSION">Comissão (%)</option>
              <option value="PER_SERVICE">Por atendimento (valor fixo)</option>
            </select>
          </div>

          {/* Campos condicionais por tipo */}
          {relationshipType === "RENTED_FIXED" && (
            <>
              <div>
                <label className="mb-1 block text-sm text-muted">Valor do aluguel (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full rounded-md border border-line px-3 py-2 text-sm"
                  {...register("rentValue", { valueAsNumber: true })}
                />
                {errors.rentValue && (
                  <p className="mt-1 text-xs text-danger">{errors.rentValue.message}</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm text-muted">Periodicidade</label>
                <select
                  className="w-full rounded-md border border-line px-3 py-2 text-sm"
                  {...register("rentPeriodicity")}
                >
                  <option value="DAILY">Diária</option>
                  <option value="WEEKLY">Semanal</option>
                  <option value="MONTHLY">Mensal</option>
                </select>
              </div>
            </>
          )}

          {relationshipType === "COMMISSION" && (
            <div>
              <label className="mb-1 block text-sm text-muted">Percentual de repasse (%)</label>
              <input
                type="number"
                step="0.01"
                min={0}
                max={100}
                className="w-full rounded-md border border-line px-3 py-2 text-sm"
                {...register("commissionPercentage", { valueAsNumber: true })}
              />
              {errors.commissionPercentage && (
                <p className="mt-1 text-xs text-danger">{errors.commissionPercentage.message}</p>
              )}
            </div>
          )}

          {relationshipType === "PER_SERVICE" && (
            <div>
              <label className="mb-1 block text-sm text-muted">Valor por atendimento (R$)</label>
              <input
                type="number"
                step="0.01"
                className="w-full rounded-md border border-line px-3 py-2 text-sm"
                {...register("defaultServiceRate", { valueAsNumber: true })}
              />
              {errors.defaultServiceRate && (
                <p className="mt-1 text-xs text-danger">{errors.defaultServiceRate.message}</p>
              )}
            </div>
          )}

          {/* Label livre (proprietário/comissionado) */}
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm text-muted">Proprietário / referência (opcional)</label>
            <input
              type="text"
              className="w-full rounded-md border border-line px-3 py-2 text-sm"
              placeholder="Ex.: Dr. Silva"
              {...register("ownerLabel")}
            />
          </div>

          {mutation.isError && (
            <p className="text-sm text-danger sm:col-span-2">
              Erro ao salvar. Verifique os dados e tente novamente.
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-60 sm:col-span-2"
          >
            {mutation.isSuccess ? "Salvo ✓" : "Salvar termos"}
          </button>
        </form>
      )}
    </div>
  );
}
