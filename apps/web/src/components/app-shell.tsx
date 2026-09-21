import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./sidebar";

const COLLAPSED_STORAGE_KEY = "sidebar-collapsed";

export function AppShell() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSED_STORAGE_KEY) === "true");

  useEffect(() => {
    localStorage.setItem(COLLAPSED_STORAGE_KEY, String(collapsed));
  }, [collapsed]);

  return (
    <div className="flex min-h-screen bg-app text-ink">
      <Sidebar collapsed={collapsed} onToggleCollapsed={() => setCollapsed((v) => !v)} />
      <main className="min-w-0 flex-1 overflow-y-auto">
        <div key={location.pathname} className="animate-page-in p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
