-- Separação de role de banco (menor privilégio) — rodar UMA VEZ, manualmente,
-- contra o banco de produção (ou qualquer ambiente que compartilhe DATABASE_URL
-- entre runtime e migrations hoje), autenticado com a role dona das tabelas
-- (a mesma usada em DIRECT_URL / prisma migrate deploy).
--
-- Objetivo: a API em runtime passa a usar uma role SEM ownership — se
-- DATABASE_URL de produção vazar, o pior caso é leitura/escrita de dado, nunca
-- DROP TABLE, ALTER TABLE ou desativar uma policy futura. Ver "Implementação
-- da Agenda Multi-Consultório — Plano Técnico" no vault Obsidian para o
-- contexto completo (isso é independente da decisão de RLS, que segue adiada).
--
-- Depois de rodar isto, trocar a credencial usada em DATABASE_URL (pooler,
-- porta 6543) para app_user/<senha>. DIRECT_URL continua com a role dona.
--
-- No Supabase: o pooler (Supavisor ou PgBouncer legado, depende do projeto)
-- pode exigir que a role seja registrada no dashboard (Project Settings >
-- Database > Connection Pooling / Roles) além deste CREATE ROLE puro —
-- verificar isso contra o projeto real antes de trocar DATABASE_URL em produção.

CREATE ROLE app_user WITH LOGIN PASSWORD '<GERAR_SENHA_FORTE_AQUI>' NOSUPERUSER NOCREATEDB NOCREATEROLE;

GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- Garante que tabelas criadas por FUTURAS migrations (rodadas pela role dona)
-- já nascem com esses grants pra app_user, sem precisar repetir este script.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_user;

-- app_user deliberadamente NÃO recebe:
--   - DDL (CREATE/ALTER/DROP TABLE) — só a role dona, via DIRECT_URL, migra o schema.
--   - TRUNCATE — evita apagar tabela inteira mesmo com a credencial de runtime.
