import { NavLink } from "react-router-dom";
import {
  Building2,
  Calendar,
  ChevronsLeft,
  ChevronsRight,
  Globe,
  Home,
  Landmark,
  LogOut,
  Package,
  Stethoscope,
  UserCog,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { Capability } from "@dentist-system/shared-types";
import { can, userRoles } from "@/lib/access";
import { useAuth } from "@/lib/auth-context";
import { initials } from "@/lib/initials";

interface NavItemDef {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  capability?: Capability;
  superAdminOnly?: boolean;
}

interface NavGroupDef {
  title: string;
  items: NavItemDef[];
}

const NAV_GROUPS: NavGroupDef[] = [
  {
    title: "Menu",
    items: [
      { to: "/", label: "Início", icon: Home, end: true, capability: "dashboard.view" },
      { to: "/agenda", label: "Agenda", icon: Calendar, capability: "agenda.view" },
      { to: "/patients", label: "Pacientes", icon: Users, capability: "patients.write" },
      { to: "/financeiro", label: "Financeiro", icon: Wallet, capability: "reports.financial" },
      { to: "/materials", label: "Estoque", icon: Package, capability: "materials.manage" },
      { to: "/procedures", label: "Procedimentos", icon: Stethoscope, capability: "procedures.write" },
    ],
  },
  {
    title: "Clínica",
    items: [
      { to: "/clinics", label: "Consultórios", icon: Building2, capability: "clinics.write" },
      { to: "/my-clinic", label: "Minha Clínica", icon: Landmark, capability: "organization.read" },
      { to: "/admin/users", label: "Usuários", icon: UserCog, capability: "users.manage" },
    ],
  },
  {
    title: "Plataforma",
    items: [{ to: "/platform", label: "Plataforma", icon: Globe, superAdminOnly: true }],
  },
];

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Tenant admin",
  DENTIST: "Dentista",
  RECEPTIONIST: "Recepcionista",
};

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

export function Sidebar({ collapsed, onToggleCollapsed }: SidebarProps) {
  const { user, logout } = useAuth();

  const groups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      if (item.superAdminOnly) return Boolean(user?.isSuperAdmin);
      return !item.capability || can(user, item.capability);
    }),
  })).filter((group) => group.items.length > 0);

  const roleLabel = user?.isSuperAdmin
    ? "Super Admin"
    : userRoles(user)
        .map((role) => ROLE_LABEL[role])
        .join(" · ");

  return (
    <aside
      className={`flex h-screen shrink-0 flex-col border-r border-line bg-surface transition-[width] duration-200 ${
        collapsed ? "w-[72px]" : "w-60"
      }`}
    >
      <div className={`flex items-center gap-2 px-4 py-5 ${collapsed ? "justify-center px-0" : ""}`}>
        {!collapsed && <span className="text-lg font-semibold text-ink">Consultório</span>}
        <button
          onClick={onToggleCollapsed}
          aria-label={collapsed ? "Expandir menu" : "Colapsar menu"}
          className={`rounded-lg p-1.5 text-muted hover:bg-gray-100 hover:text-ink ${collapsed ? "" : "ml-auto"}`}
        >
          {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
        </button>
      </div>

      <nav className="flex-1 space-y-6 px-3 py-2">
        {groups.map((group) => (
          <div key={group.title}>
            {!collapsed && (
              <p className="mb-2 px-2 text-xs font-medium uppercase tracking-wide text-muted">{group.title}</p>
            )}
            <ul className="space-y-1">
              {group.items.map((item) => (
                <li key={item.to} className="group relative">
                  <NavLink
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                        collapsed ? "justify-center" : ""
                      } ${isActive ? "bg-brand-50 text-accent" : "text-gray-700 hover:bg-gray-100"}`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <item.icon className={`h-5 w-5 shrink-0 ${isActive ? "text-accent" : "text-gray-500"}`} />
                        {!collapsed && <span>{item.label}</span>}
                      </>
                    )}
                  </NavLink>
                  {collapsed && (
                    <span className="pointer-events-none absolute left-full top-1/2 z-10 ml-2 -translate-y-1/2 whitespace-nowrap rounded-lg bg-ink px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
                      {item.label}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className={`border-t border-line p-3 ${collapsed ? "flex flex-col items-center gap-2" : ""}`}>
        <div className={`flex items-center gap-2.5 ${collapsed ? "" : "mb-2"}`}>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-accent">
            {user ? initials(user.name) : ""}
          </span>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">{user?.name}</p>
              <p className="truncate text-xs text-muted">{roleLabel}</p>
            </div>
          )}
        </div>
        <button
          onClick={() => void logout()}
          aria-label="Sair"
          className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-muted hover:bg-gray-100 hover:text-ink ${
            collapsed ? "justify-center" : "w-full"
          }`}
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && "Sair"}
        </button>
      </div>
    </aside>
  );
}
