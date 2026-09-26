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
import { AppShell } from "@/components/app-shell";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route path="/" element={<HomeRoute />} />

            <Route element={<ProtectedRoute capability="organization.read" />}>
              <Route path="/my-clinic" element={<MyClinicPage />} />
            </Route>

            <Route element={<ProtectedRoute superAdminOnly />}>
              <Route path="/platform" element={<PlatformPage />} />
              <Route path="/platform/organizations/:id" element={<OrganizationDetailPage />} />
            </Route>

            <Route element={<ProtectedRoute capability="users.manage" />}>
              <Route path="/admin/users" element={<AdminUsersPage />} />
            </Route>

            <Route element={<ProtectedRoute capability="agenda.view" />}>
              <Route path="/agenda" element={<AgendaPage />} />
            </Route>

            <Route element={<ProtectedRoute capability="patients.write" />}>
              <Route path="/patients" element={<PatientsPage />} />
              <Route path="/patients/:patientId" element={<PatientDetailPage />} />
            </Route>

            <Route element={<ProtectedRoute capability="materials.manage" />}>
              <Route path="/materials" element={<MaterialsPage />} />
            </Route>

            <Route element={<ProtectedRoute capability="reports.financial" />}>
              <Route path="/financeiro" element={<FinanceiroPage />} />
            </Route>

            <Route element={<ProtectedRoute capability="procedures.write" />}>
              <Route path="/procedures" element={<ProceduresPage />} />
            </Route>

            <Route element={<ProtectedRoute capability="clinics.write" />}>
              <Route path="/clinics" element={<ClinicsPage />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
