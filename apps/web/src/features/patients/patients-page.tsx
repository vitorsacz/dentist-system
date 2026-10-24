import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createPatientSchema, isPatientComplete, type CreatePatientInput } from "@dentist-system/shared-types";
import { PageHeader } from "@/components/ui/page-header";
import { patientsApi } from "./api";

const MARITAL_STATUS_OPTIONS = [
  { value: "SOLTEIRO", label: "Solteiro(a)" },
  { value: "CASADO", label: "Casado(a)" },
  { value: "DIVORCIADO", label: "Divorciado(a)" },
  { value: "VIUVO", label: "Viúvo(a)" },
  { value: "UNIAO_ESTAVEL", label: "União estável" },
];

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
          className="grid max-w-2xl gap-4 rounded-lg border border-line bg-surface p-6 sm:grid-cols-2"
        >
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm text-muted">Nome completo</label>
            <input className="w-full rounded-md border border-line px-3 py-2 text-sm" {...register("name")} />
            {errors.name && <p className="mt-1 text-sm text-bad">{errors.name.message}</p>}
          </div>
          <div>
            <label className="mb-1 block text-sm text-muted">Telefone</label>
            <input className="w-full rounded-md border border-line px-3 py-2 text-sm" {...register("phone")} />
            {errors.phone && <p className="mt-1 text-sm text-bad">{errors.phone.message}</p>}
          </div>
          <div>
            <label className="mb-1 block text-sm text-muted">CPF (opcional)</label>
            <input
              className="w-full rounded-md border border-line px-3 py-2 text-sm"
              placeholder="000.000.000-00"
              {...register("cpf")}
            />
            {errors.cpf && <p className="mt-1 text-sm text-bad">{errors.cpf.message}</p>}
          </div>
          <div>
            <label className="mb-1 block text-sm text-muted">E-mail (opcional)</label>
            <input
              type="email"
              className="w-full rounded-md border border-line px-3 py-2 text-sm"
              {...register("email")}
            />
            {errors.email && <p className="mt-1 text-sm text-bad">{errors.email.message}</p>}
          </div>
          <div>
            <label className="mb-1 block text-sm text-muted">Data de nascimento (opcional)</label>
            <input
              type="date"
              className="w-full rounded-md border border-line px-3 py-2 text-sm"
              {...register("birthDate")}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-muted">Sexo (opcional)</label>
            <select className="w-full rounded-md border border-line px-3 py-2 text-sm" {...register("sex")}>
              <option value="">Selecionar</option>
              <option value="F">Feminino</option>
              <option value="M">Masculino</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-muted">Estado civil (opcional)</label>
            <select className="w-full rounded-md border border-line px-3 py-2 text-sm" {...register("maritalStatus")}>
              <option value="">Selecionar</option>
              {MARITAL_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-muted">Profissão (opcional)</label>
            <input className="w-full rounded-md border border-line px-3 py-2 text-sm" {...register("profession")} />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm text-muted">Endereço (opcional)</label>
            <input className="w-full rounded-md border border-line px-3 py-2 text-sm" {...register("address")} />
          </div>
          <div>
            <label className="mb-1 block text-sm text-muted">Bebida de espera (opcional)</label>
            <input
              className="w-full rounded-md border border-line px-3 py-2 text-sm"
              placeholder="Ex.: café, água"
              {...register("preferredDrink")}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-muted">Música preferida (opcional)</label>
            <input
              className="w-full rounded-md border border-line px-3 py-2 text-sm"
              placeholder="Ex.: MPB, sertanejo"
              {...register("preferredMusic")}
            />
          </div>
          {createMutation.error && (
            <p className="text-sm text-bad sm:col-span-2">
              {(createMutation.error as { message?: string }).message ?? "Erro ao salvar"}
            </p>
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

      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-muted">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Telefone</th>
              <th className="px-4 py-3">Dentista responsável</th>
              <th className="px-4 py-3">Cadastro</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {patientsQuery.data?.map((patient) => (
              <tr key={patient.id}>
                <td className="px-4 py-3">{patient.name}</td>
                <td className="px-4 py-3">{patient.phone}</td>
                <td className="px-4 py-3 text-muted">{patient.ownerDentist?.name ?? "—"}</td>
                <td className="px-4 py-3">
                  {isPatientComplete(patient) ? (
                    <span className="rounded-full bg-good/10 px-2 py-0.5 text-xs text-good">Completo</span>
                  ) : (
                    <span className="rounded-full bg-warn/10 px-2 py-0.5 text-xs text-warn">Incompleto</span>
                  )}
                </td>
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
