import { Navigate, Outlet } from "react-router-dom";
import type { Role } from "@dentist-system/shared-types";
import { useAuth } from "@/lib/auth-context";

export function ProtectedRoute({ roles, superAdminOnly }: { roles?: Role[]; superAdminOnly?: boolean }) {
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

  if (roles && (!user.role || !roles.includes(user.role))) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
