import { ConfigService } from "@nestjs/config";
import type { NestExpressApplication } from "@nestjs/platform-express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import type { Env } from "./config/env.validation";

// Configuração HTTP da app, compartilhada entre main.ts e os testes e2e — a
// suíte roda com os mesmos middlewares da produção.
export function configureApp(app: NestExpressApplication) {
  const config = app.get<ConfigService<Env, true>>(ConfigService);

  // A API roda no Render, atrás de proxy: sem isso req.ip seria o IP do
  // proxy e todos os clientes dividiriam o mesmo rate limit. Número de
  // saltos (não `true`), senão qualquer cliente forjaria o IP mandando
  // X-Forwarded-For.
  app.set("trust proxy", config.get("TRUST_PROXY_HOPS", { infer: true }));

  // API só JSON: nenhuma resposta é HTML, então a CSP pode negar tudo. CORS
  // (com credentials) é tratado pelo enableCors abaixo — os headers do helmet
  // não interferem em requisições em modo cors.
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
      },
    }),
  );

  app.use(cookieParser());
  app.enableCors({
    origin: config.get("CORS_ORIGIN", { infer: true }),
    credentials: true,
  });
}
