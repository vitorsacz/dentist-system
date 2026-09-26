import { Navigate, Outlet } from "react-router-dom";
import type { Capability } from "@dentist-system/shared-types";
import { can } from "@/lib/access";
import { useAuth } from "@/lib/auth-context";

export function ProtectedRoute({ capability, superAdminOnly }: { capability?: Capability; superAdminOnly?: boolean }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center text-muted">Carregando…</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (superAdminOnly && !user.isSuperAdmin) {
    return <Navigate to="/" replace />;
  }

  if (capability && !can(user, capability)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
