import { useState } from "react";
import { useParams } from "react-router-dom";
import { can } from "@/lib/access";
import { useAuth } from "@/lib/auth-context";
import { AnamnesisTab } from "./tabs/anamnesis-tab";
import { ClinicalRecordsTab } from "./tabs/clinical-records-tab";
import { OdontogramTab } from "./tabs/odontogram-tab";
import { BudgetsTab } from "./tabs/budgets-tab";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { isPatientComplete, updatePatientSchema, type UpdatePatientInput } from "@dentist-system/shared-types";
import { myClinicApi } from "@/features/my-clinic/api";
import { patientsApi } from "./api";

type TabKey = "anamnesis" | "clinical-records" | "odontogram" | "budgets" | "revisions";

const MARITAL_STATUS_OPTIONS = [
  { value: "SOLTEIRO", label: "Solteiro(a)" },
  { value: "CASADO", label: "Casado(a)" },
  { value: "DIVORCIADO", label: "Divorciado(a)" },
  { value: "VIUVO", label: "Viúvo(a)" },
  { value: "UNIAO_ESTAVEL", label: "União estável" },
];

const MARITAL_LABEL: Record<string, string> = Object.fromEntries(
  MARITAL_STATUS_OPTIONS.map((o) => [o.value, o.label]),
);

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

export function PatientDetailPage() {
  const { patientId = "" } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canSeeClinical = can(user, "clinical.read");
  const canEditOwner = can(user, "organization.dentists");
  const [tab, setTab] = useState<TabKey>(canSeeClinical ? "anamnesis" : "budgets");
  const [editMode, setEditMode] = useState(false);

  const patientQuery = useQuery({
    queryKey: ["patients", patientId],
    queryFn: () => patientsApi.findOne(patientId),
  });

  const accessQuery = useQuery({
    queryKey: ["patients", patientId, "access"],
    queryFn: () => patientsApi.getAccess(patientId),
    enabled: !!patientQuery.data,
  });

  const dentistsQuery = useQuery({
    queryKey: ["organization", "dentists"],
    queryFn: myClinicApi.dentists,
    enabled: canEditOwner && editMode,
  });

  const revisionsQuery = useQuery({
    queryKey: ["patients", patientId, "revisions"],
    queryFn: () => patientsApi.getRevisions(patientId),
    enabled: tab === "revisions",
  });

  const patient = patientQuery.data;
  const access = accessQuery.data;

  const shareMutation = useMutation({
    mutationFn: (dentistId: string) => patientsApi.share(patientId, { dentistId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["patients", patientId, "access"] }),
  });

  const revokeMutation = useMutation({
    mutationFn: (dentistId: string) => patientsApi.revoke(patientId, dentistId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["patients", patientId, "access"] }),
  });

  const [shareSelect, setShareSelect] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<UpdatePatientInput>({
    resolver: zodResolver(updatePatientSchema),
  });

  function startEdit() {
    if (!patient) return;
    reset({
      name: patient.name,
      phone: patient.phone,
      birthDate: patient.birthDate ? new Date(patient.birthDate) : undefined,
      address: patient.address ?? undefined,
      sex: (patient.sex as UpdatePatientInput["sex"]) ?? undefined,
      maritalStatus: (patient.maritalStatus as UpdatePatientInput["maritalStatus"]) ?? undefined,
      profession: patient.profession ?? undefined,
      email: patient.email ?? undefined,
      cpf: patient.cpf ? maskCpf(patient.cpf) : undefined,
      preferredDrink: patient.preferredDrink ?? undefined,
      preferredMusic: patient.preferredMusic ?? undefined,
      ownerDentistId: patient.ownerDentist?.id ?? undefined,
    });
    setEditMode(true);
  }

  const updateMutation = useMutation({
    mutationFn: (data: UpdatePatientInput) => patientsApi.update(patientId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patients", patientId] });
      queryClient.invalidateQueries({ queryKey: ["patients", patientId, "revisions"] });
      setEditMode(false);
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: (active: boolean) => patientsApi.toggleActive(patientId, active),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["patients", patientId] }),
  });

  const isAdmin = can(user, "users.manage");

  function handleToggleActive() {
    if (!patient) return;
    const next = !patient.active;
    const msg = next
      ? "Reativar este paciente?"
      : "Desativar não apaga histórico nem cancela agendamentos. Deseja continuar?";
    if (confirm(msg)) toggleActiveMutation.mutate(next);
  }

  const tabs: { key: TabKey; label: string }[] = [
    ...(canSeeClinical
      ? ([
          { key: "anamnesis", label: "Anamnese" },
          { key: "clinical-records", label: "Prontuário" },
          { key: "odontogram", label: "Odontograma" },
        ] as const)
      : []),
    { key: "budgets", label: "Orçamentos" },
    { key: "revisions", label: "Histórico" },
  ];

  return (
    <div className="space-y-6">
      {editMode && patient ? (
        <form
          onSubmit={handleSubmit((data) => updateMutation.mutate(data))}
          className="grid max-w-2xl gap-4 rounded-lg border border-line bg-surface p-6 sm:grid-cols-2"
        >
          <div className="flex items-center justify-between sm:col-span-2">
            <h2 className="text-lg font-semibold text-ink">Editar dados</h2>
            <button type="button" onClick={() => setEditMode(false)} className="text-sm text-muted">
              Cancelar
            </button>
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm text-muted">Nome completo</label>
            <input className="w-full rounded-md border border-line px-3 py-2 text-sm" {...register("name")} />
            {errors.name && <p className="mt-1 text-sm text-bad">{errors.name.message}</p>}
          </div>
          <div>
            <label className="mb-1 block text-sm text-muted">Telefone</label>
            <input
              className="w-full rounded-md border border-line px-3 py-2 text-sm"
              {...register("phone")}
              onChange={(e) => {
                const masked = maskPhone(e.target.value);
                e.target.value = masked;
                setValue("phone", masked);
              }}
            />
          </div>
          {canEditOwner && (
            <div>
              <label className="mb-1 block text-sm text-muted">Dentista responsável</label>
              <select className="w-full rounded-md border border-line px-3 py-2 text-sm" {...register("ownerDentistId")}>
                <option value="">Sem responsável</option>
                {dentistsQuery.data?.map((d) => (
                  <option key={d.userId} value={d.userId}>{d.name}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm text-muted">CPF</label>
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
            <label className="mb-1 block text-sm text-muted">E-mail</label>
            <input type="email" className="w-full rounded-md border border-line px-3 py-2 text-sm" {...register("email")} />
            {errors.email && <p className="mt-1 text-sm text-bad">{errors.email.message}</p>}
          </div>
          <div>
            <label className="mb-1 block text-sm text-muted">Data de nascimento</label>
            <input type="date" className="w-full rounded-md border border-line px-3 py-2 text-sm" {...register("birthDate")} />
          </div>
          <div>
            <label className="mb-1 block text-sm text-muted">Sexo</label>
            <select className="w-full rounded-md border border-line px-3 py-2 text-sm" {...register("sex")}>
              <option value="">Selecionar</option>
              <option value="F">Feminino</option>
              <option value="M">Masculino</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-muted">Estado civil</label>
            <select className="w-full rounded-md border border-line px-3 py-2 text-sm" {...register("maritalStatus")}>
              <option value="">Selecionar</option>
              {MARITAL_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-muted">Profissão</label>
            <input className="w-full rounded-md border border-line px-3 py-2 text-sm" {...register("profession")} />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm text-muted">Endereço</label>
            <input className="w-full rounded-md border border-line px-3 py-2 text-sm" {...register("address")} />
          </div>
          <div>
            <label className="mb-1 block text-sm text-muted">Bebida de espera</label>
            <input className="w-full rounded-md border border-line px-3 py-2 text-sm" {...register("preferredDrink")} />
          </div>
          <div>
            <label className="mb-1 block text-sm text-muted">Música preferida</label>
            <input className="w-full rounded-md border border-line px-3 py-2 text-sm" {...register("preferredMusic")} />
          </div>
          {updateMutation.error && (
            <p className="text-sm text-bad sm:col-span-2">
              {(updateMutation.error as { message?: string }).message ?? "Erro ao salvar"}
            </p>
          )}
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-60 sm:col-span-2"
          >
            Salvar alterações
          </button>
        </form>
      ) : (
        <>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold text-ink">{patient?.name}</h1>
                {patient && !patient.active && (
                  <span className="rounded-full bg-bad/10 px-2 py-0.5 text-xs text-bad">Inativo</span>
                )}
                {patient && !isPatientComplete(patient) && (
                  <span className="rounded-full bg-warn/10 px-2 py-0.5 text-xs text-warn">
                    Cadastro incompleto
                  </span>
                )}
              </div>
              <p className="text-sm text-muted">{patient?.phone}</p>
              {patient?.ownerDentist && (
                <p className="mt-1 text-xs text-muted">Responsável: {patient.ownerDentist.name}</p>
              )}
            </div>
            <div className="flex gap-2">
              {patient && (isAdmin || access?.canShare) && (
                <button
                  type="button"
                  disabled={toggleActiveMutation.isPending}
                  onClick={handleToggleActive}
                  className="rounded-md border border-line px-3 py-1.5 text-sm text-muted hover:text-ink disabled:opacity-60"
                >
                  {patient.active ? "Desativar" : "Reativar"}
                </button>
              )}
              <button
                onClick={startEdit}
                className="rounded-md border border-line px-3 py-1.5 text-sm text-muted hover:text-ink"
              >
                Editar dados
              </button>
            </div>
          </div>

          {patient && (
            <div className="grid gap-2 rounded-lg border border-line bg-surface p-4 text-sm sm:grid-cols-3">
              {patient.email && <div><span className="text-muted">E-mail: </span>{patient.email}</div>}
              {patient.cpf && (
                <div>
                  <span className="text-muted">CPF: </span>
                  {maskCpf(patient.cpf)}
                </div>
              )}
              {patient.sex && <div><span className="text-muted">Sexo: </span>{patient.sex === "F" ? "Feminino" : "Masculino"}</div>}
              {patient.maritalStatus && <div><span className="text-muted">Estado civil: </span>{MARITAL_LABEL[patient.maritalStatus] ?? patient.maritalStatus}</div>}
              {patient.profession && <div><span className="text-muted">Profissão: </span>{patient.profession}</div>}
              {patient.address && <div className="sm:col-span-2"><span className="text-muted">Endereço: </span>{patient.address}</div>}
              {patient.preferredDrink && <div><span className="text-muted">Bebida: </span>{patient.preferredDrink}</div>}
              {patient.preferredMusic && <div><span className="text-muted">Música: </span>{patient.preferredMusic}</div>}
            </div>
          )}
        </>
      )}

      {access?.canShare && (
        <div className="rounded-lg border border-line bg-surface p-4 text-sm">
          <h3 className="mb-3 font-medium text-ink">Acesso clínico</h3>
          {access.activeShares && access.activeShares.length > 0 && (
            <ul className="mb-3 space-y-1">
              {access.activeShares.map((s) => (
                <li key={s.dentistId} className="flex items-center justify-between">
                  <span className="text-muted">{s.dentist.name}</span>
                  <button
                    type="button"
                    onClick={() => revokeMutation.mutate(s.dentistId)}
                    disabled={revokeMutation.isPending}
                    className="text-xs text-bad disabled:opacity-60"
                  >
                    Revogar
                  </button>
                </li>
              ))}
            </ul>
          )}
          {access.eligibleDentists && access.eligibleDentists.length > 0 && (
            <div className="flex gap-2">
              <select
                className="flex-1 rounded-md border border-line px-3 py-1.5 text-sm"
                value={shareSelect}
                onChange={(e) => setShareSelect(e.target.value)}
              >
                <option value="">Compartilhar com dentista...</option>
                {access.eligibleDentists.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
              <button
                type="button"
                disabled={!shareSelect || shareMutation.isPending}
                onClick={() => { if (shareSelect) { shareMutation.mutate(shareSelect); setShareSelect(""); } }}
                className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
              >
                Compartilhar
              </button>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-4 border-b border-line">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`border-b-2 px-1 pb-2 text-sm ${
              tab === t.key ? "border-accent text-ink" : "border-transparent text-muted"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "anamnesis" && canSeeClinical && <AnamnesisTab patientId={patientId} readOnly={access ? !access.canWriteClinical : undefined} />}
      {tab === "clinical-records" && canSeeClinical && <ClinicalRecordsTab patientId={patientId} readOnly={access ? !access.canWriteClinical : undefined} />}
      {tab === "odontogram" && canSeeClinical && <OdontogramTab patientId={patientId} readOnly={access ? !access.canWriteClinical : undefined} />}
      {tab === "budgets" && <BudgetsTab patientId={patientId} />}
      {tab === "revisions" && (
        <div className="space-y-3">
          {revisionsQuery.data?.length === 0 && (
            <p className="text-sm text-muted">Nenhuma edição registrada.</p>
          )}
          {revisionsQuery.data?.map((rev) => (
            <div key={rev.id} className="rounded-lg border border-line bg-surface p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium">{rev.changedBy.name}</span>
                <span className="text-xs text-muted">{new Date(rev.changedAt).toLocaleString("pt-BR")}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
