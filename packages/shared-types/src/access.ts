import type { Role } from "./enums";

// Matriz de permissões por papel — ÚNICA fonte de verdade de "qual papel pode
// o quê". A API usa em @Roles(...ACCESS["capacidade"]) e o front em
// can(user, "capacidade"). Mudar quem acessa algo = mudar aqui.
//
// Fora da matriz, de propósito:
// - Regras por tipo de organização (termos financeiros só pra FREELANCER,
//   criar consultório só pra FREELANCER, eixo da agenda por tipo): continuam
//   nos services/componentes, porque dependem da organização, não do papel.
// - Super Admin: não é papel de tenant (flag isSuperAdmin); tem guard próprio
//   (SuperAdminGuard) e não aparece aqui.
// - Rotas liberadas pra qualquer autenticado (@AllowAuthenticated: auth/me,
//   auth/logout, GET organization, platform/*) e rotas públicas.
export const ACCESS = {
  // Pacientes (cadastro, não dado clínico). Leitura inclui ADMIN pro seletor
  // de paciente da Agenda.
  "patients.read": ["ADMIN", "DENTIST", "RECEPTIONIST"],
  "patients.write": ["DENTIST", "RECEPTIONIST"],

  // Dado clínico: anamnese, prontuário/evolução, odontograma.
  "clinical.read": ["DENTIST"],
  "clinical.write": ["DENTIST"],

  "appointments.manage": ["DENTIST", "RECEPTIONIST"],

  // Atendimento financeiro (lançamento com baixa de estoque).
  "attendances.read": ["DENTIST"],
  "attendances.write": ["DENTIST"],

  "budgets.read": ["DENTIST", "RECEPTIONIST"],
  "budgets.write": ["DENTIST", "RECEPTIONIST"],
  "budgets.status": ["DENTIST", "RECEPTIONIST"],

  // Catálogo de procedimentos e preços. Leitura inclui ADMIN pra Agenda.
  "procedures.read": ["ADMIN", "DENTIST", "RECEPTIONIST"],
  "procedures.write": ["DENTIST"],

  // Consultórios. Leitura inclui ADMIN pra Agenda.
  "clinics.read": ["ADMIN", "DENTIST", "RECEPTIONIST"],
  "clinics.write": ["DENTIST"],

  "clinicFinancialTerms.manage": ["DENTIST"],
  "materials.manage": ["DENTIST", "RECEPTIONIST"],
  "recalls.manage": ["DENTIST", "RECEPTIONIST"],
  "reports.financial": ["DENTIST"],

  // "Minha Clínica". Na API, GET organization é @AllowAuthenticated (o Super
  // Admin recebe 400 lá dentro); esta capacidade controla a tela no front.
  "organization.read": ["ADMIN", "DENTIST", "RECEPTIONIST"],
  // Lista de dentistas da organização (sidebar "por dentista" da Agenda).
  "organization.dentists": ["ADMIN", "RECEPTIONIST"],

  "users.manage": ["ADMIN"],

  // Só telas do front (sem rota de API equivalente).
  "agenda.view": ["ADMIN", "DENTIST", "RECEPTIONIST"],
  "dashboard.view": ["DENTIST", "RECEPTIONIST"],
} as const satisfies Record<string, readonly Role[]>;

export type Capability = keyof typeof ACCESS;

// Um usuário pode ter mais de um papel: tem a capacidade se QUALQUER um dos
// papéis dele estiver na lista.
export function rolesHaveAccess(roles: readonly Role[], capability: Capability): boolean {
  const allowed: readonly Role[] = ACCESS[capability];
  return roles.some((role) => allowed.includes(role));
}
