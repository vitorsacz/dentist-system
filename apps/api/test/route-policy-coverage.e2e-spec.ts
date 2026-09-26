import { Controller, ForbiddenException, Get, type ExecutionContext } from "@nestjs/common";
import { METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { RequestMethod } from "@nestjs/common/enums/request-method.enum";
import { DiscoveryModule, DiscoveryService, MetadataScanner, Reflector } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { AppModule } from "../src/app.module";
import { ALLOW_AUTHENTICATED_KEY, AllowAuthenticated } from "../src/common/decorators/allow-authenticated.decorator";
import { IS_PUBLIC_KEY, Public } from "../src/common/decorators/public.decorator";
import { ROLES_KEY, Roles } from "../src/common/decorators/roles.decorator";
import { RolesGuard, resolveRoutePolicy } from "../src/common/guards/roles.guard";

// Rede de segurança do RBAC "nega por padrão": todo handler HTTP registrado
// no AppModule precisa declarar uma política — @Public, @Roles ou
// @AllowAuthenticated — no próprio handler ou na classe. O RolesGuard já
// responde 403 pra rota sem política, mas isso só aparece em runtime; este
// teste pega o esquecimento no CI, antes do deploy.
//
// Só compila o módulo (não chama app.init()), então não conecta no banco.

type DiscoveredRoute = {
  label: string;
  handler: object;
  controllerClass: object;
};

const POLICY_KEYS = [ROLES_KEY, IS_PUBLIC_KEY, ALLOW_AUTHENTICATED_KEY] as const;

describe("Cobertura de política de acesso (RBAC nega por padrão)", () => {
  let routes: DiscoveredRoute[];
  let reflector: Reflector;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule, DiscoveryModule] }).compile();
    const discovery = moduleRef.get(DiscoveryService);
    const scanner = moduleRef.get(MetadataScanner);
    reflector = moduleRef.get(Reflector);

    routes = [];
    for (const wrapper of discovery.getControllers()) {
      const controllerClass = wrapper.metatype as (new (...args: never[]) => object) | undefined;
      if (!controllerClass) continue;
      const prototype = controllerClass.prototype as Record<string, unknown>;
      const controllerPath = Reflect.getMetadata(PATH_METADATA, controllerClass) as string;

      for (const methodName of scanner.getAllMethodNames(prototype)) {
        const handler = prototype[methodName] as object;
        const routePath = Reflect.getMetadata(PATH_METADATA, handler) as string | undefined;
        if (routePath === undefined) continue; // método auxiliar, não é rota
        const httpMethod = RequestMethod[Reflect.getMetadata(METHOD_METADATA, handler) as number];
        const fullPath = [controllerPath, routePath].filter((part) => part && part !== "/").join("/");
        routes.push({
          label: `${controllerClass.name}.${methodName} (${httpMethod} /${fullPath})`,
          handler,
          controllerClass,
        });
      }
    }
  });

  it("encontra os controllers e rotas do AppModule (sanidade da descoberta)", () => {
    expect(routes.length).toBeGreaterThan(40);
    expect(routes.some((route) => route.label.startsWith("AuthController.me "))).toBe(true);
  });

  it("todo handler declara @Public, @Roles ou @AllowAuthenticated (no handler ou na classe)", () => {
    const missing = routes
      .filter((route) => !resolveRoutePolicy(reflector, route.handler, route.controllerClass))
      .map((route) => route.label);

    if (missing.length > 0) {
      throw new Error(
        `Rota(s) sem política de acesso declarada — o RolesGuard responde 403 pra elas:\n` +
          missing.map((label) => `  - ${label}`).join("\n") +
          `\nO que fazer: decore o handler (ou a classe do controller) com @Roles(...) ` +
          `pros papéis que podem acessar, @AllowAuthenticated() se qualquer usuário logado ` +
          `pode, ou @Public() se nem login é exigido.`,
      );
    }
  });

  // Rota pública não passa por nenhuma checagem de login: cada uma aqui é
  // superfície de ataque aberta a qualquer um. Adicionar uma nova exige
  // atualizar esta lista de propósito — e garantir que ela não revela se um
  // e-mail existe ou em quais organizações está (ver auth-login.e2e-spec.ts).
  it("as rotas públicas são exatamente as esperadas", () => {
    const publicRoutes = routes
      .filter((route) => resolveRoutePolicy(reflector, route.handler, route.controllerClass)?.kind === "public")
      .map((route) => route.label)
      .sort();
    expect(publicRoutes).toEqual([
      "AuthController.login (POST /auth/login)",
      "AuthController.refresh (POST /auth/refresh)",
      "HealthController.check (GET /health)",
    ]);
  });

  it("nenhum nível (handler ou classe) declara mais de uma política ao mesmo tempo", () => {
    const ambiguous: string[] = [];
    for (const route of routes) {
      for (const [level, target] of [
        ["handler", route.handler],
        ["classe", route.controllerClass],
      ] as const) {
        const declared = POLICY_KEYS.filter((key) => reflector.get(key, target as never) !== undefined);
        if (declared.length > 1) {
          ambiguous.push(`  - ${route.label} — ${level} tem ${declared.join(" + ")}`);
        }
      }
    }
    if (ambiguous.length > 0) {
      throw new Error(
        `Política ambígua (use só um de @Public/@Roles/@AllowAuthenticated por nível):\n` +
          [...new Set(ambiguous)].join("\n"),
      );
    }
  });
});

// Comportamento do guard em si, com controllers de mentira — prova o "nega por
// padrão" sem depender de nenhuma rota real ficar sem decorator.
describe("RolesGuard", () => {
  @Controller()
  class UndecoratedController {
    @Get()
    open() {}
  }

  @Controller()
  @AllowAuthenticated()
  class AuthenticatedController {
    @Get()
    anyone() {}

    @Roles("ADMIN")
    @Get("admin")
    adminOnly() {}
  }

  @Controller()
  @Roles("DENTIST")
  class DentistController {
    @Get()
    dentist() {}

    @Public()
    @Get("public")
    publicRoute() {}
  }

  const guard = new RolesGuard(new Reflector());

  function contextFor(controllerClass: object, handler: object, user?: object): ExecutionContext {
    return {
      getHandler: () => handler,
      getClass: () => controllerClass,
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    } as unknown as ExecutionContext;
  }

  const dentist = { roles: ["DENTIST"], isSuperAdmin: false };
  const admin = { roles: ["ADMIN"], isSuperAdmin: false };
  const superAdmin = { roles: [], isSuperAdmin: true };

  it("nega rota sem política, mesmo pra usuário autenticado", () => {
    const ctx = contextFor(UndecoratedController, UndecoratedController.prototype.open, dentist);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it("@AllowAuthenticated libera qualquer papel, inclusive Super Admin sem role", () => {
    const handler = AuthenticatedController.prototype.anyone;
    expect(guard.canActivate(contextFor(AuthenticatedController, handler, dentist))).toBe(true);
    expect(guard.canActivate(contextFor(AuthenticatedController, handler, superAdmin))).toBe(true);
  });

  it("@Roles no handler vence @AllowAuthenticated da classe", () => {
    const handler = AuthenticatedController.prototype.adminOnly;
    expect(guard.canActivate(contextFor(AuthenticatedController, handler, admin))).toBe(true);
    expect(() => guard.canActivate(contextFor(AuthenticatedController, handler, dentist))).toThrow(
      ForbiddenException,
    );
  });

  it("@Roles da classe vale pros handlers sem decorator próprio", () => {
    const handler = DentistController.prototype.dentist;
    expect(guard.canActivate(contextFor(DentistController, handler, dentist))).toBe(true);
    expect(() => guard.canActivate(contextFor(DentistController, handler, admin))).toThrow(ForbiddenException);
    expect(() => guard.canActivate(contextFor(DentistController, handler, superAdmin))).toThrow(
      ForbiddenException,
    );
  });

  it("@Public libera sem usuário", () => {
    const ctx = contextFor(DentistController, DentistController.prototype.publicRoute, undefined);
    expect(guard.canActivate(ctx)).toBe(true);
  });
});
