import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginInput } from "@dentist-system/shared-types";
import { apiClient, ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (data: LoginInput) => {
    setError(null);
    try {
      const result = await apiClient.post<{ accessToken: string }>("/auth/login", data);
      await login(result.accessToken);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao entrar");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-app">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="w-full max-w-sm space-y-4 rounded-lg border border-line bg-surface p-8"
      >
        <h1 className="text-xl font-semibold text-ink">Entrar</h1>

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

        {error && <p className="text-sm text-bad">{error}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-md bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {isSubmitting ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}
