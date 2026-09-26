import { TEST_DATABASE_URL } from "./test-db";

// Precisa rodar ANTES do grafo de módulos ser importado (Jest `setupFiles`
// roda antes do arquivo de teste) — `prisma.service.ts` instancia o
// PrismaClient no topo do módulo, lendo DATABASE_URL/DIRECT_URL de
// process.env no momento do import, não em algum hook posterior.
process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.DIRECT_URL = TEST_DATABASE_URL;

// Rate limit desligado na suíte (muitos logins seguidos do mesmo IP gerariam
// 429 intermitente). Só test/rate-limit.e2e-spec.ts religa.
process.env.RATE_LIMIT_DISABLED = "true";
