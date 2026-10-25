import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createPatientSchema, isPatientComplete, type CreatePatientInput } from "@dentist-system/shared-types";
import { PageHeader } from "@/components/ui/page-header";
import { useAuth } from "@/lib/auth-context";
import { can } from "@/lib/access";
import { myClinicApi } from "@/features/my-clinic/api";
import type { MyClinic } from "@dentist-system/shared-types";
import { patientsApi } from "./api";

const MARITAL_STATUS_OPTIONS = [
  { value: "SOLTEIRO", label: "Solteiro(a)" },
  { value: "CASADO", label: "Casado(a)" },
  { value: "DIVORCIADO", label: "Divorciado(a)" },
  { value: "VIUVO", label: "Viúvo(a)" },
  { value: "UNIAO_ESTAVEL", label: "União estável" },
];

function maskCpf(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

function maskPhone(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10) return d.replace(/^(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3");
  return d.replace(/^(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3");
}

export function PatientsPage() {
  const [showForm, setShowForm] = useState(false);
  const [includeInactive, setIncludeInactive] = useState(false);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const needsDentistSelect = can(user, "organization.dentists");
  const isAdmin = can(user, "users.manage");
  const isDentist = can(user, "patients.claim");

  const patientsQuery = useQuery({
    queryKey: ["patients", { includeInactive }],
    queryFn: () => patientsApi.list({ includeInactive }),
  });
  const dentistsQuery = useQuery({
    queryKey: ["organization", "dentists"],
    queryFn: () => myClinicApi.dentists(),
    enabled: needsDentistSelect,
  });
  const orgQuery = useQuery<MyClinic>({
    queryKey: ["organization"],
    queryFn: myClinicApi.get,
    enabled: isDentist,
  });
  const isFreelancer = orgQuery.data?.type === "FREELANCER";
  const unassignedQuery = useQuery({
    queryKey: ["patients", "unassigned"],
    queryFn: patientsApi.listUnassigned,
    enabled: isDentist && !isFreelancer,
  });

  const claimMutation = useMutation({
    mutationFn: patientsApi.claim,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patients"] });
      queryClient.invalidateQueries({ queryKey: ["patients", "unassigned"] });
    },
    onError: (err: unknown) => {
      const status = (err as { status?: number }).status;
      if (status === 409) alert("Este paciente já tem dentista responsável.");
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
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
            <input
              className="w-full rounded-md border border-line px-3 py-2 text-sm"
              placeholder="(11) 99999-9999"
              {...register("phone")}
              onChange={(e) => {
                const masked = maskPhone(e.target.value);
                e.target.value = masked;
                setValue("phone", masked);
              }}
            />
            {errors.phone && <p className="mt-1 text-sm text-bad">{errors.phone.message}</p>}
          </div>
          {needsDentistSelect && (
            <div>
              <label className="mb-1 block text-sm text-muted">
                Dentista responsável <span className="text-bad">*</span>
              </label>
              <select
                className="w-full rounded-md border border-line px-3 py-2 text-sm"
                {...register("ownerDentistId")}
              >
                <option value="">Selecionar dentista</option>
                {dentistsQuery.data?.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              {errors.ownerDentistId && (
                <p className="mt-1 text-sm text-bad">{errors.ownerDentistId.message}</p>
              )}
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm text-muted">CPF (opcional)</label>
            <input
              className="w-full rounded-md border border-line px-3 py-2 text-sm"
              placeholder="000.000.000-00"
              {...register("cpf")}
              onChange={(e) => {
                const masked = maskCpf(e.target.value);
                e.target.value = masked;
                setValue("cpf", masked);
              }}
            />
            {errors.cpf && <p className="mt-1 text-sm text-bad">{errors.cpf.message}</p>}
          </div>
          <div>
            <label className="mb-1 block text-sm text-muted">E-mail (opcional)</label>
            <input type="email" className="w-full rounded-md border border-line px-3 py-2 text-sm" {...register("email")} />
            {errors.email && <p className="mt-1 text-sm text-bad">{errors.email.message}</p>}
          </div>
          <div>
            <label className="mb-1 block text-sm text-muted">Data de nascimento (opcional)</label>
            <input type="date" className="w-full rounded-md border border-line px-3 py-2 text-sm" {...register("birthDate")} />
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
            <input className="w-full rounded-md border border-line px-3 py-2 text-sm" placeholder="Ex.: café, água" {...register("preferredDrink")} />
          </div>
          <div>
            <label className="mb-1 block text-sm text-muted">Música preferida (opcional)</label>
            <input className="w-full rounded-md border border-line px-3 py-2 text-sm" placeholder="Ex.: MPB, sertanejo" {...register("preferredMusic")} />
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
              <th className="px-4 py-3">Telefone</th>
              <th className="px-4 py-3">Dentista responsável</th>
              <th className="px-4 py-3">Cadastro</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {patientsQuery.data?.map((patient) => (
              <tr key={patient.id} className={!patient.active ? "opacity-60" : undefined}>
                <td className="px-4 py-3 flex items-center gap-2">
                  {patient.name}
                  {!patient.active && (
                    <span className="rounded-full bg-bad/10 px-2 py-0.5 text-xs text-bad">Inativo</span>
                  )}
                </td>
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
                  <Link to={`/patients/${patient.id}`} className="text-accent">Ver</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isDentist && !isFreelancer && unassignedQuery.data && unassignedQuery.data.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-base font-medium text-ink">Pacientes sem responsável</h2>
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
                {unassignedQuery.data.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3">{p.name}</td>
                    <td className="px-4 py-3">{p.phone}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        disabled={claimMutation.isPending}
                        onClick={() => claimMutation.mutate(p.id)}
                        className="rounded-md bg-accent px-3 py-1 text-xs font-medium text-white disabled:opacity-60"
                      >
                        Assumir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
