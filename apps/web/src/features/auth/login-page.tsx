import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import type { AccountOption, LoginResult } from "@dentist-system/shared-types";
import { apiClient, ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";

// Identidade é isolada por organização: o mesmo e-mail pode ter conta em mais
// de uma, com senhas diferentes. O login manda e-mail/apelido + senha de uma
// vez; só se a senha conferir em mais de uma organização a API devolve a lista
// (apenas as organizações em que ela conferiu) e o formulário pede a escolha,
// reenviando com organizationId — a senha é validada de novo nesse reenvio.
export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [accounts, setAccounts] = useState<AccountOption[] | null>(null);
  const [organizationId, setOrganizationId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Mudou e-mail ou senha depois da lista aparecer: a lista valia pra outra
  // combinação, volta pro login simples.
  const resetSelection = () => {
    setAccounts(null);
    setOrganizationId("");
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await apiClient.post<LoginResult>("/auth/login", {
        identifier,
        password,
        organizationId: accounts ? organizationId : undefined,
      });
      if ("requiresOrganizationSelection" in result) {
        setAccounts(result.accounts);
        setOrganizationId(result.accounts[0]?.organizationId ?? "");
        return;
      }
      await login(result.accessToken);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao entrar");
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
        <h1 className="text-xl font-semibold text-ink">Entrar</h1>

        <div>
          <label htmlFor="login-identifier" className="mb-1 block text-sm text-muted">
            E-mail ou apelido
          </label>
          <input
            id="login-identifier"
            type="text"
            autoComplete="username"
            className="w-full rounded-md border border-line px-3 py-2 text-sm"
            value={identifier}
            onChange={(e) => {
              setIdentifier(e.target.value);
              resetSelection();
            }}
            autoFocus
          />
        </div>

        <div>
          <label htmlFor="login-password" className="mb-1 block text-sm text-muted">
            Senha
          </label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            className="w-full rounded-md border border-line px-3 py-2 text-sm"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              resetSelection();
            }}
          />
        </div>

        {accounts && (
          <div>
            <label htmlFor="login-organization" className="mb-1 block text-sm text-muted">
              Organização
            </label>
            <p className="mb-2 text-xs text-muted">
              Você tem conta em mais de uma organização. Escolha em qual quer entrar.
            </p>
            <select
              id="login-organization"
              className="w-full rounded-md border border-line px-3 py-2 text-sm"
              value={organizationId}
              onChange={(e) => setOrganizationId(e.target.value)}
            >
              {accounts.map((account) => (
                <option key={account.organizationId} value={account.organizationId}>
                  {account.organizationName}
                </option>
              ))}
            </select>
          </div>
        )}

        {error && <p className="text-sm text-bad">{error}</p>}

        <button
          type="submit"
          disabled={isSubmitting || !identifier || !password || (accounts !== null && !organizationId)}
          className="w-full rounded-md bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {isSubmitting ? "Aguarde…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}
