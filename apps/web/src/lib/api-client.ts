const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

let accessToken: string | null = null;

// 401 nestas rotas não dispara refresh: no login, 401 é credencial errada (e
// um refresh ali reativaria uma sessão antiga do cookie); no refresh, é o
// próprio refresh que falhou.
const NO_REFRESH_RETRY_PATHS = new Set(["/auth/login", "/auth/refresh"]);

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });

  if (res.status === 401 && retry && !NO_REFRESH_RETRY_PATHS.has(path)) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return request<T>(path, options, false);
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(res.status, body.message ?? "Erro na requisição");
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

// O refresh token é rotacionado a cada uso e o servidor trata reuso de um
// token antigo como roubo (revoga a sessão inteira). Por isso só pode existir
// UM refresh em andamento por vez:
// - na mesma aba: chamadas paralelas (várias requisições com 401, StrictMode
//   montando o AuthProvider duas vezes) esperam a mesma promessa;
// - entre abas: Web Locks API serializa as abas do mesmo site — a segunda aba
//   só manda o refresh depois que a primeira terminou, já com o cookie novo.
let refreshInFlight: Promise<boolean> | null = null;
const REFRESH_LOCK_NAME = "dentist-system:auth-refresh";

export function refreshAccessToken(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = withRefreshLock(doRefresh).finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

async function withRefreshLock<T>(fn: () => Promise<T>): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.locks) {
    // O lock fica preso até a promessa de `fn` terminar.
    return (await navigator.locks.request(REFRESH_LOCK_NAME, fn)) as T;
  }
  return fn();
}

async function doRefresh(): Promise<boolean> {
  try {
    const data = await request<{ accessToken: string }>("/auth/refresh", { method: "POST" }, false);
    setAccessToken(data.accessToken);
    return true;
  } catch {
    setAccessToken(null);
    return false;
  }
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
