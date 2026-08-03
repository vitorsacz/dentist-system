import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createUserSchema,
  resetPasswordSchema,
  type CreateUserInput,
  type ResetPasswordInput,
  type Role,
} from "@dentist-system/shared-types";
import { adminUsersApi } from "./api";
import { useAuth } from "@/lib/auth-context";

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Admin",
  DENTIST: "Dentista",
  RECEPTIONIST: "Recepcionista",
};

function ResetPasswordForm({ userId, onDone }: { userId: string; onDone: () => void }) {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({ resolver: zodResolver(resetPasswordSchema) });

  const mutation = useMutation({
    mutationFn: (input: ResetPasswordInput) => adminUsersApi.resetPassword(userId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      onDone();
    },
  });

  return (
    <form
      onSubmit={handleSubmit((data) => mutation.mutate(data))}
      className="flex items-center gap-2"
    >
      <input
        type="password"
        placeholder="Nova senha"
        autoFocus
        className="w-40 rounded-md border border-line px-2 py-1 text-sm"
        {...register("password")}
      />
      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-md bg-accent px-2 py-1 text-xs font-medium text-white disabled:opacity-60"
      >
        Salvar
      </button>
      <button type="button" onClick={onDone} className="text-xs text-muted">
        Cancelar
      </button>
      {errors.password && <p className="text-xs text-bad">{errors.password.message}</p>}
    </form>
  );
}

export function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const usersQuery = useQuery({ queryKey: ["admin", "users"], queryFn: adminUsersApi.list });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { role: "DENTIST" },
  });

  const createMutation = useMutation({
    mutationFn: adminUsersApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      reset({ role: "DENTIST", name: "", email: "", password: "" });
      setShowForm(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...input }: { id: string } & Parameters<typeof adminUsersApi.update>[1]) =>
      adminUsersApi.update(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "users"] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-ink">Usuários</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white"
        >
          {showForm ? "Cancelar" : "Novo usuário"}
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
            <label className="mb-1 block text-sm text-muted">E-mail</label>
            <input
              type="email"
              className="w-full rounded-md border border-line px-3 py-2 text-sm"
              {...register("email")}
            />
            {errors.email && <p className="mt-1 text-sm text-bad">{errors.email.message}</p>}
          </div>
          <div>
            <label className="mb-1 block text-sm text-muted">Senha</label>
            <input
              type="password"
              className="w-full rounded-md border border-line px-3 py-2 text-sm"
              {...register("password")}
            />
            {errors.password && <p className="mt-1 text-sm text-bad">{errors.password.message}</p>}
          </div>
          <div>
            <label className="mb-1 block text-sm text-muted">Papel</label>
            <select className="w-full rounded-md border border-line px-3 py-2 text-sm" {...register("role")}>
              {Object.entries(ROLE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
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
              <th className="px-4 py-3">E-mail</th>
              <th className="px-4 py-3">Papel</th>
              <th className="px-4 py-3">Ativo</th>
              <th className="px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {usersQuery.data?.map((user) => {
              const isSelf = user.id === currentUser?.id;
              return (
                <tr key={user.id}>
                  <td className="px-4 py-3">{user.name}</td>
                  <td className="px-4 py-3">{user.email}</td>
                  <td className="px-4 py-3">
                    <select
                      value={user.role}
                      disabled={isSelf}
                      onChange={(e) =>
                        updateMutation.mutate({ id: user.id, role: e.target.value as Role })
                      }
                      className="rounded-md border border-line px-2 py-1 text-sm disabled:opacity-50"
                    >
                      {Object.entries(ROLE_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={user.active}
                      disabled={isSelf}
                      onChange={(e) => updateMutation.mutate({ id: user.id, active: e.target.checked })}
                    />
                    {isSelf && <span className="ml-2 text-xs text-muted">(você)</span>}
                  </td>
                  <td className="px-4 py-3">
                    {resetUserId === user.id ? (
                      <ResetPasswordForm userId={user.id} onDone={() => setResetUserId(null)} />
                    ) : (
                      <button
                        onClick={() => setResetUserId(user.id)}
                        className="text-xs font-medium text-accent"
                      >
                        Redefinir senha
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
