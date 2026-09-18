import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createOrganizationSchema, type CreateOrganizationInput } from "@dentist-system/shared-types";
import { Card } from "@/components/ui/card";
import { platformApi } from "./api";

export function CreateOrganizationForm({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateOrganizationInput>({ resolver: zodResolver(createOrganizationSchema) });

  const createMutation = useMutation({
    mutationFn: platformApi.createOrganization,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform"] });
      reset();
      onDone();
    },
  });

  return (
    <Card>
      <form onSubmit={handleSubmit((data) => createMutation.mutate(data))} className="grid max-w-xl gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm text-muted">Nome da clínica</label>
          <input className="w-full rounded-md border border-line px-3 py-2 text-sm" {...register("name")} />
          {errors.name && <p className="mt-1 text-sm text-bad">{errors.name.message}</p>}
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm text-muted">Nome do admin fundador</label>
          <input className="w-full rounded-md border border-line px-3 py-2 text-sm" {...register("foundingAdminName")} />
          {errors.foundingAdminName && <p className="mt-1 text-sm text-bad">{errors.foundingAdminName.message}</p>}
        </div>
        <div>
          <label className="mb-1 block text-sm text-muted">E-mail do admin fundador</label>
          <input
            type="email"
            className="w-full rounded-md border border-line px-3 py-2 text-sm"
            {...register("foundingAdminEmail")}
          />
          {errors.foundingAdminEmail && <p className="mt-1 text-sm text-bad">{errors.foundingAdminEmail.message}</p>}
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
    </Card>
  );
}
