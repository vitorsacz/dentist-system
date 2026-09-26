import { rolesHaveAccess, type Capability, type Role } from "@dentist-system/shared-types";

// Papéis do usuário como lista. Hoje a API manda um papel só (`role`); quando
// o usuário passar a ter vários (`roles`), a lista vem direto e nada mais
// precisa mudar nas telas.
interface UserWithRoles {
  role?: Role | null;
  roles?: readonly Role[];
}

export function userRoles(user: UserWithRoles | null | undefined): readonly Role[] {
  if (!user) return [];
  if (user.roles) return user.roles;
  return user.role ? [user.role] : [];
}

// Única forma de o front decidir "este usuário pode X?" — a matriz vive em
// ACCESS (@dentist-system/shared-types), a mesma que a API usa em @Roles.
// Super Admin não tem papel de tenant e nunca passa aqui (ver isSuperAdmin).
export function can(user: UserWithRoles | null | undefined, capability: Capability): boolean {
  return rolesHaveAccess(userRoles(user), capability);
}
