import { Navigate } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";
import { DashboardPage } from "@/features/dashboard/dashboard-page";

export function HomeRoute() {
  const { user } = useAuth();

  if (user?.isSuperAdmin) {
    return <Navigate to="/platform" replace />;
  }

  if (user?.role === "ADMIN") {
    return <Navigate to="/admin/users" replace />;
  }

  return <DashboardPage />;
}
