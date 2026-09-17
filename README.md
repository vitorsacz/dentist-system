# Dentist System

Sistema de gestão para uma dentista que atende em mais de um consultório
(próprio e/ou alugado). Cobre pacientes/prontuário, anamnese, odontograma,
orçamento, agenda, financeiro com repasse por consultório e estoque de
materiais.

## Stack

- **Monorepo**: pnpm workspaces + Turborepo
- **API** (`apps/api`): NestJS + Prisma 5 + PostgreSQL, autenticação JWT
  (access token em memória + refresh token em cookie httpOnly), validação de
  entrada com Zod
- **Web** (`apps/web`): React + Vite, TanStack Query, React Hook Form + Zod,
  Tailwind
- **`packages/shared-types`**: schemas Zod compartilhados entre API e web
  (contrato de request/response)

```
dentist-system/
├── apps/
│   ├── api/     # NestJS + Prisma
│   └── web/     # React + Vite
└── packages/
    ├── shared-types/
    ├── eslint-config/
    └── tsconfig/
```

## Pré-requisitos

- Node.js >= 20
- pnpm (`corepack enable` já resolve a versão fixada em `packageManager`)
- PostgreSQL rodando localmente (ex.: `brew install postgresql@16` no macOS)

## Subindo o projeto localmente

### 1. Instalar dependências

```bash
pnpm install
```

### 2. Banco de dados

Crie um banco local (ex. via `psql`):

```bash
createdb dentist_system
```

### 3. Variáveis de ambiente

Copie os `.env.example` de cada app e preencha:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

`apps/api/.env`:

```
DATABASE_URL="postgresql://usuario:senha@localhost:5432/dentist_system"
DIRECT_URL="postgresql://usuario:senha@localhost:5432/dentist_system"
JWT_ACCESS_SECRET="gere-com-crypto-randomBytes-32-hex"
JWT_REFRESH_SECRET="gere-outro-diferente"
PORT=3000
CORS_ORIGIN="http://localhost:5173"

SEED_ADMIN_EMAIL="admin@example.com"
SEED_ADMIN_PASSWORD="escolha-uma-senha"
SEED_ADMIN_NAME="Admin"

SEED_DENTIST_EMAIL="dentista@example.com"
SEED_DENTIST_PASSWORD="escolha-uma-senha"
SEED_DENTIST_NAME="Dra. Exemplo"
```

Em desenvolvimento local, `DATABASE_URL` e `DIRECT_URL` podem apontar para o
mesmo banco (a distinção entre pooler de transação e conexão direta só importa
em produção com Supabase — ver seção de deploy). Gere os segredos JWT com:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

`apps/web/.env`:

```
VITE_API_URL="http://localhost:3000"
```

### 4. Migrations + seed

```bash
pnpm db:migrate   # aplica as migrations do Prisma no banco local
pnpm db:seed      # cria os usuários definidos em SEED_ADMIN_*/SEED_DENTIST_*
```

O seed é idempotente — rodar de novo não duplica usuários com o mesmo e-mail.
Se uma variável `SEED_*` não estiver definida, aquele usuário é pulado sem
quebrar o script.

### 5. Rodar em desenvolvimento

```bash
pnpm dev
```

Isso sobe API e web em paralelo via Turborepo:

- API: `http://localhost:3000` (health check em `GET /health`)
- Web: `http://localhost:5173`

Login com o usuário criado pelo seed (`SEED_DENTIST_EMAIL`/
`SEED_DENTIST_PASSWORD`, ou `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` para o
painel administrativo).

## Scripts úteis

Na raiz (via Turborepo, roda em todos os workspaces):

```bash
pnpm dev         # API + web em modo watch
pnpm build       # build de produção de tudo
pnpm lint
pnpm typecheck
pnpm test
```

Banco de dados:

```bash
pnpm db:migrate   # prisma migrate dev
pnpm db:generate  # prisma generate
pnpm db:seed      # roda prisma/seed.ts
```

## Multi-tenancy

O sistema é multi-organização: toda tabela de negócio carrega `organizationId`,
isolado automaticamente por uma Prisma Client Extension (não RLS do Postgres —
ver decisão documentada no vault Obsidian do projeto) usando
`AsyncLocalStorage` pra propagar o contexto de tenant por request
(`apps/api/src/prisma/tenant.extension.ts` + `tenant-context.ts`). `User` é
identidade global (email/senha); `Membership` liga um `User` a uma
`Organization` com um papel (`Role`: `ADMIN`/`DENTIST`/`RECEPTIONIST`) — um
usuário pode ter mais de uma membership em organizações diferentes, embora
hoje o login sempre resolva a primeira automaticamente (sem seletor de
organização, feature futura).

Não existe cadastro público — o primeiro usuário/organização nascem do seed; a
partir daí só o `ADMIN` da organização cria novos usuários pelo painel
(`/admin/users`). RBAC é reforçado no backend por um `RolesGuard` global, não
só escondido na UI — recepcionista, por exemplo, nunca tem acesso a anamnese,
prontuário, odontograma ou dados financeiros.

Teste de isolamento cross-tenant: `pnpm --filter @dentist-system/api test`
(usa um banco Postgres separado, `dentist_system_test` local ou
`TEST_DATABASE_URL` em CI) — seeda 2 organizations e confirma que acesso
cruzado por ID em todo endpoint responde 404, nunca vazamento.

### Separação de role de banco (produção)

`apps/api/prisma/scripts/create-app-role.sql` cria uma role Postgres
(`app_user`) sem permissão de alterar schema, pra ser usada só pela API em
runtime (`DATABASE_URL`) — `DIRECT_URL`/migrations continuam com a role dona.
Reduz o raio de um vazamento de credencial de produção a leitura/escrita de
dado, nunca `DROP TABLE`/alterar schema. Rodar uma vez contra o banco de
produção; no Supabase pode exigir um passo extra no dashboard pra registrar a
role no pooler — ver comentários no próprio script.

## Deploy

- **API**: Render (`render.yaml` na raiz — Blueprint), build roda
  `prisma migrate deploy` automaticamente a cada deploy.
- **Web**: Vercel (`apps/web/vercel.json`), root directory `apps/web`.
- **Banco**: PostgreSQL gerenciado (ex. Supabase) — use o **pooler de
  transação** (porta 6543, `?pgbouncer=true`) em `DATABASE_URL` e o **pooler
  de sessão** (porta 5432) em `DIRECT_URL`, já que a conexão direta costuma
  ser IPv6-only e falhar em ambientes como o Render.

Secrets de produção (`DATABASE_URL`, `DIRECT_URL`, `JWT_ACCESS_SECRET`,
`JWT_REFRESH_SECRET`, `CORS_ORIGIN`, `SEED_*`) são configurados manualmente no
dashboard do provedor — nunca versionados no repositório.
