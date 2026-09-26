import { SetMetadata } from "@nestjs/common";

// Libera a rota pra qualquer usuário autenticado, de qualquer papel (inclusive
// o Super Admin, que não tem `role`). O RolesGuard nega por padrão: rota sem
// @Public, @Roles ou @AllowAuthenticated responde 403 — usar este decorator é
// a forma explícita de dizer "aberta a todos os logados", nunca a ausência de
// decorator.
export const ALLOW_AUTHENTICATED_KEY = "allowAuthenticated";
export const AllowAuthenticated = () => SetMetadata(ALLOW_AUTHENTICATED_KEY, true);
