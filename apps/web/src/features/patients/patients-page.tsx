import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createPatientSchema, type CreatePatientInput } from "@dentist-system/shared-types";
import { PageHeader } from "@/components/ui/page-header";
import { patientsApi } from "./api";

export function PatientsPage() {
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();
  const patientsQuery = useQuery({ queryKey: ["patients"], queryFn: patientsApi.list });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreatePatientInput>({ resolver: zodResolver(createPatientSchema) });

  const createMutation = useMutation({
    mutationFn: patientsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patients"] });
      reset();
      setShowForm(false);
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb="Início / Pacientes"
        title="Pacientes"
        action={
          <button
            onClick={() => setShowForm((v) => !v)}
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white"
          >
            {showForm ? "Cancelar" : "Novo paciente"}
          </button>
        }
      />

      {showForm && (
        <form
          onSubmit={handleSubmit((data) => createMutation.mutate(data))}
          className="grid max-w-xl gap-4 rounded-lg border border-line bg-surface p-6 sm:grid-cols-2"
        >
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm text-muted">Nome</label>
            <input className="w-full rounded-md border border-line px-3 py-2 text-sm" {...register("name")} />
            {errors.name && <p className="mt-1 text-sm text-bad">{errors.name.message}</p>}
          </div>
          <div>
            <label className="mb-1 block text-sm text-muted">Telefone</label>
            <input className="w-full rounded-md border border-line px-3 py-2 text-sm" {...register("phone")} />
            {errors.phone && <p className="mt-1 text-sm text-bad">{errors.phone.message}</p>}
          </div>
          <div>
            <label className="mb-1 block text-sm text-muted">Data de nascimento</label>
            <input
              type="date"
              className="w-full rounded-md border border-line px-3 py-2 text-sm"
              {...register("birthDate")}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm text-muted">Endereço (opcional)</label>
            <input className="w-full rounded-md border border-line px-3 py-2 text-sm" {...register("address")} />
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
              <th className="px-4 py-3">Telefone</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {patientsQuery.data?.map((patient) => (
              <tr key={patient.id}>
                <td className="px-4 py-3">{patient.name}</td>
                <td className="px-4 py-3">{patient.phone}</td>
                <td className="px-4 py-3 text-right">
                  <Link to={`/patients/${patient.id}`} className="text-accent">
                    Ver
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
