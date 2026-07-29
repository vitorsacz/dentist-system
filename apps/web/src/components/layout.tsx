import { NavLink, Outlet } from "react-router-dom";
import type { Role } from "@dentist-system/shared-types";
import { useAuth } from "@/lib/auth-context";

interface NavLinkDef {
  to: string;
  label: string;
  end?: boolean;
  roles?: Role[];
}

const NAV_LINKS: NavLinkDef[] = [
  { to: "/", label: "Início", end: true, roles: ["DENTIST", "RECEPTIONIST"] },
  { to: "/patients", label: "Pacientes", roles: ["DENTIST", "RECEPTIONIST"] },
  { to: "/agenda", label: "Agenda", roles: ["DENTIST", "RECEPTIONIST"] },
  { to: "/financeiro", label: "Financeiro", roles: ["DENTIST"] },
  { to: "/materials", label: "Estoque", roles: ["DENTIST", "RECEPTIONIST"] },
  { to: "/procedures", label: "Procedimentos", roles: ["DENTIST"] },
  { to: "/clinics", label: "Consultórios", roles: ["DENTIST"] },
  { to: "/admin/users", label: "Usuários", roles: ["ADMIN"] },
];

function NavItem({ to, label, end }: { to: string; label: string; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `border-b py-0.5 text-sm transition-colors ${
          isActive ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink"
        }`
      }
    >
      {label}
    </NavLink>
  );
}

export function Layout() {
  const { user, logout } = useAuth();

  const links = NAV_LINKS.filter((link) => !link.roles || (user && link.roles.includes(user.role)));

  return (
    <div className="min-h-screen bg-app text-ink">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line px-8 py-4">
        <div className="flex flex-wrap items-center gap-8">
          <span className="text-xl font-semibold">Consultório</span>
          <nav className="flex flex-wrap gap-6">
            {links.map((link) => (
              <NavItem key={link.to} to={link.to} label={link.label} end={link.end} />
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted">{user?.name}</span>
          <button
            onClick={() => void logout()}
            className="rounded-md border border-line px-3 py-1.5 text-sm text-muted transition-colors hover:text-ink"
          >
            Sair
          </button>
        </div>
      </header>
      <main className="p-8">
        <Outlet />
      </main>
    </div>
  );
}
