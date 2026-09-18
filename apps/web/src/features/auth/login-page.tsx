import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import type { AccountOption, LookupAccountsResult } from "@dentist-system/shared-types";
import { apiClient, ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";

// Identidade é isolada por tenant: o mesmo e-mail pode existir em mais de uma
// organização (contas completamente independentes). Login em 2 passos:
// 1) identifier (e-mail ou apelido) -> lookup decide se precisa escolher
// organização antes da senha. Apelido é sempre 1:1, nunca pede escolha.
export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [accounts, setAccounts] = useState<AccountOption[] | null>(null);
  const [organizationId, setOrganizationId] = useState("");
  const [step, setStep] = useState<"identifier" | "password">("identifier");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLookup = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await apiClient.post<LookupAccountsResult>("/auth/lookup", { identifier });
      if (result.requiresOrganizationSelection) {
        setAccounts(result.accounts);
        setOrganizationId(result.accounts[0]?.organizationId ?? "");
      } else {
        setAccounts(null);
      }
      setStep("password");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao verificar e-mail");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await apiClient.post<{ accessToken: string }>("/auth/login", {
        identifier,
        password,
        organizationId: accounts ? organizationId : undefined,
      });
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
        onSubmit={step === "identifier" ? handleLookup : handleLogin}
        className="w-full max-w-sm space-y-4 rounded-lg border border-line bg-surface p-8"
      >
        <h1 className="text-xl font-semibold text-ink">Entrar</h1>

        <div>
          <label className="mb-1 block text-sm text-muted">E-mail ou apelido</label>
          <input
            type="text"
            className="w-full rounded-md border border-line px-3 py-2 text-sm disabled:opacity-60"
            value={identifier}
            disabled={step === "password"}
            onChange={(e) => setIdentifier(e.target.value)}
            autoFocus
          />
        </div>

        {step === "password" && accounts && (
          <div>
            <label className="mb-1 block text-sm text-muted">Organização</label>
            <select
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

        {step === "password" && (
          <div>
            <label className="mb-1 block text-sm text-muted">Senha</label>
            <input
              type="password"
              className="w-full rounded-md border border-line px-3 py-2 text-sm"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
          </div>
        )}

        {error && <p className="text-sm text-bad">{error}</p>}

        {step === "password" && (
          <button
            type="button"
            onClick={() => {
              setStep("identifier");
              setPassword("");
              setError(null);
            }}
            className="text-xs text-muted hover:text-ink"
          >
            Trocar e-mail
          </button>
        )}

        <button
          type="submit"
          disabled={isSubmitting || (step === "identifier" ? !identifier : !password)}
          className="w-full rounded-md bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {isSubmitting ? "Aguarde…" : step === "identifier" ? "Continuar" : "Entrar"}
        </button>
      </form>
    </div>
  );
}
