import { useEffect, useRef, useState } from "react";
import { Bell, ChevronDown, Search } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

const MOCK_NOTIFICATIONS = [
  { id: "1", text: "Novo agendamento confirmado para hoje às 14h00." },
  { id: "2", text: "Orçamento de Marina Souza foi aprovado." },
  { id: "3", text: "Estoque de resina composta está baixo." },
];

function useClickOutside<T extends HTMLElement>(onOutside: () => void) {
  const ref = useRef<T>(null);
  useEffect(() => {
    function handler(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onOutside();
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onOutside]);
  return ref;
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function DashboardHeader() {
  const { user, logout } = useAuth();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);

  const notificationsRef = useClickOutside<HTMLDivElement>(() => setNotificationsOpen(false));
  const avatarRef = useClickOutside<HTMLDivElement>(() => setAvatarOpen(false));

  return (
    <header className="flex items-center justify-between gap-4 border-b border-line bg-surface px-6 py-3">
      <div className="flex items-center gap-8">
        <span className="text-lg font-semibold text-ink">Consultório</span>
        <div className="relative hidden sm:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Buscar paciente, orçamento..."
            disabled
            className="w-72 rounded-lg border border-line bg-transparent py-2 pl-9 pr-3 text-sm text-ink placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-70"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative" ref={notificationsRef}>
          <button
            onClick={() => setNotificationsOpen((v) => !v)}
            className="relative rounded-lg p-2 text-muted hover:bg-gray-100 hover:text-ink"
            aria-label="Notificações"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-error-solid" />
          </button>
          {notificationsOpen && (
            <div className="absolute right-0 z-10 mt-2 w-72 rounded-2xl border border-line bg-surface p-2 shadow-lg">
              <p className="px-2 py-1 text-xs font-medium text-muted">Notificações</p>
              <ul className="divide-y divide-line">
                {MOCK_NOTIFICATIONS.map((n) => (
                  <li key={n.id} className="px-2 py-2 text-sm text-ink">
                    {n.text}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="relative" ref={avatarRef}>
          <button
            onClick={() => setAvatarOpen((v) => !v)}
            className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-gray-100"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-accent">
              {user ? initials(user.name) : ""}
            </span>
            <span className="hidden text-sm font-medium text-ink sm:block">{user?.name}</span>
            <ChevronDown className="h-4 w-4 text-muted" />
          </button>
          {avatarOpen && (
            <div className="absolute right-0 z-10 mt-2 w-56 rounded-2xl border border-line bg-surface p-2 shadow-lg">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium text-ink">{user?.name}</p>
                <p className="text-xs text-muted">{user?.email}</p>
              </div>
              <button
                onClick={() => void logout()}
                className="mt-1 w-full rounded-lg px-2 py-1.5 text-left text-sm text-bad hover:bg-error-light"
              >
                Sair
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
