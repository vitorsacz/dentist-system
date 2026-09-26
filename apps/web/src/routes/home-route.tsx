import { Navigate } from "react-router-dom";
import { can } from "@/lib/access";
import { useAuth } from "@/lib/auth-context";
import { DashboardPage } from "@/features/dashboard/dashboard-page";

export function HomeRoute() {
  const { user } = useAuth();

  if (user?.isSuperAdmin) {
    return <Navigate to="/platform" replace />;
  }

  // Quem não tem a tela inicial (hoje: ADMIN) cai direto na gestão de
  // usuários.
  if (!can(user, "dashboard.view") && can(user, "users.manage")) {
    return <Navigate to="/admin/users" replace />;
  }

  return <DashboardPage />;
}
