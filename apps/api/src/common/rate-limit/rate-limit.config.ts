// Limites de requisição por IP do cliente (ver `trust proxy` em app.setup.ts —
// sem ele, atrás do proxy do Render todo mundo teria o mesmo IP e dividiria
// o mesmo limite). Contagem em memória: vale por instância da API.

export const RATE_LIMIT_WINDOW_MS = 60_000;

// Qualquer rota autenticada ou pública, por IP.
export const GLOBAL_RATE_LIMIT = 100;

// POST /auth/login — contra força bruta de senha.
export const LOGIN_RATE_LIMIT = 5;

// POST /auth/refresh — mais folgado que o login de propósito: o front chama
// refresh a cada carregamento de página (2x em dev, StrictMode) e a equipe de
// uma clínica costuma sair pelo mesmo IP. Com 5/min, recarregar a página
// algumas vezes derrubaria a sessão (refresh 429 = logout no front). O refresh
// só funciona com um cookie válido, então não serve pra testar senha.
export const REFRESH_RATE_LIMIT = 30;

export const RATE_LIMIT_MESSAGE = "Muitas tentativas. Aguarde um minuto e tente novamente.";

// Só pra suíte de testes (test/env-setup.ts): desliga o limite pra não gerar
// falha intermitente. O teste de rate limit religa. Nunca definir em produção.
export function isRateLimitDisabled(): boolean {
  return process.env.RATE_LIMIT_DISABLED === "true";
}
