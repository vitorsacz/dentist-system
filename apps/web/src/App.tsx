import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { LoginPage } from "@/features/auth/login-page";
import { PatientsPage } from "@/features/patients/patients-page";
import { PatientDetailPage } from "@/features/patients/patient-detail-page";
import { AgendaPage } from "@/features/agenda/agenda-page";
import { FinanceiroPage } from "@/features/financeiro/financeiro-page";
import { MaterialsPage } from "@/features/materials/materials-page";
import { ProceduresPage } from "@/features/procedures/procedures-page";
import { ClinicsPage } from "@/features/clinics/clinics-page";
import { AdminUsersPage } from "@/features/admin/admin-users-page";
import { MyClinicPage } from "@/features/my-clinic/my-clinic-page";
import { PlatformPage } from "@/features/platform/platform-page";
import { OrganizationDetailPage } from "@/features/platform/organization-detail-page";
import { ProtectedRoute } from "@/routes/protected-route";
import { HomeRoute } from "@/routes/home-route";
import { Layout } from "@/components/layout";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<HomeRoute />} />

          <Route element={<Layout />}>
            <Route element={<ProtectedRoute roles={["ADMIN", "DENTIST", "RECEPTIONIST"]} />}>
              <Route path="/my-clinic" element={<MyClinicPage />} />
            </Route>

            <Route element={<ProtectedRoute superAdminOnly />}>
              <Route path="/platform" element={<PlatformPage />} />
              <Route path="/platform/organizations/:id" element={<OrganizationDetailPage />} />
            </Route>

            <Route element={<ProtectedRoute roles={["ADMIN"]} />}>
              <Route path="/admin/users" element={<AdminUsersPage />} />
            </Route>

            <Route element={<ProtectedRoute roles={["DENTIST", "RECEPTIONIST"]} />}>
              <Route path="/patients" element={<PatientsPage />} />
              <Route path="/patients/:patientId" element={<PatientDetailPage />} />
              <Route path="/agenda" element={<AgendaPage />} />
              <Route path="/materials" element={<MaterialsPage />} />
              <Route element={<ProtectedRoute roles={["DENTIST"]} />}>
                <Route path="/financeiro" element={<FinanceiroPage />} />
                <Route path="/procedures" element={<ProceduresPage />} />
                <Route path="/clinics" element={<ClinicsPage />} />
              </Route>
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
