import { Navigate } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";
import { DashboardPage } from "@/features/dashboard/dashboard-page";

export function HomeRoute() {
  const { user } = useAuth();

  if (user?.role === "ADMIN") {
    return <Navigate to="/admin/users" replace />;
  }

  return <DashboardPage />;
}
