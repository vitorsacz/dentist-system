import { rolesHaveAccess, type Capability, type Role } from "@dentist-system/shared-types";

// Papéis do usuário (R1: pode ter mais de um). Vazio pro Super Admin e pra
// quem não está logado.
interface UserWithRoles {
  roles: readonly Role[];
}

export function userRoles(user: UserWithRoles | null | undefined): readonly Role[] {
  return user?.roles ?? [];
}

// Única forma de o front decidir "este usuário pode X?" — a matriz vive em
// ACCESS (@dentist-system/shared-types), a mesma que a API usa em @Roles.
// Super Admin não tem papel de tenant e nunca passa aqui (ver isSuperAdmin).
export function can(user: UserWithRoles | null | undefined, capability: Capability): boolean {
  return rolesHaveAccess(userRoles(user), capability);
}
