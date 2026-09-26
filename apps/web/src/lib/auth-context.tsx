import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { CurrentUser } from "@dentist-system/shared-types";
import { apiClient, refreshAccessToken, setAccessToken } from "./api-client";

interface AuthContextValue {
  user: CurrentUser | null;
  isLoading: boolean;
  login: (accessToken: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadUser = useCallback(async () => {
    try {
      const me = await apiClient.get<CurrentUser>("/auth/me");
      setUser(me);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Tenta restaurar a sessão via refresh cookie httpOnly ao carregar o app.
    // Passa pelo refresh único do api-client (nunca POST /auth/refresh direto):
    // o StrictMode monta este efeito duas vezes e duas rotações paralelas com o
    // mesmo token seriam tratadas como reuso pelo servidor.
    refreshAccessToken().then((refreshed) => (refreshed ? loadUser() : setIsLoading(false)));
  }, [loadUser]);

  const login = useCallback(
    async (accessToken: string) => {
      setAccessToken(accessToken);
      await loadUser();
    },
    [loadUser],
  );

  const logout = useCallback(async () => {
    await apiClient.post("/auth/logout").catch(() => undefined);
    setAccessToken(null);
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, isLoading, login, logout }}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth deve ser usado dentro de AuthProvider");
  }
  return ctx;
}
