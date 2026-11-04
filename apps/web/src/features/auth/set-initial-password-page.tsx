import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient, ApiError } from "@/lib/api-client";

export function SetInitialPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const changeToken = sessionStorage.getItem("changeToken") ?? "";

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (password !== confirm) {
      setError("As senhas não coincidem");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await apiClient.post("/auth/set-initial-password", { changeToken, newPassword: password });
      sessionStorage.removeItem("changeToken");
      navigate("/login", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao definir senha");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-app">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-lg border border-line bg-surface p-8"
      >
        <h1 className="text-xl font-semibold text-ink">Defina sua senha</h1>
        <p className="text-sm text-ink-muted">Por segurança, defina uma nova senha antes de continuar.</p>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-ink">
            Nova senha
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="mt-1 w-full rounded border border-line bg-bg px-3 py-2 text-sm text-ink"
          />
        </div>
        <div>
          <label htmlFor="confirm" className="block text-sm font-medium text-ink">
            Confirmar senha
          </label>
          <input
            id="confirm"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={8}
            className="mt-1 w-full rounded border border-line bg-bg px-3 py-2 text-sm text-ink"
          />
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {isSubmitting ? "Salvando..." : "Salvar senha"}
        </button>
      </form>
    </div>
  );
}
