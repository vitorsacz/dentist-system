# Ambiente dev local

Passo a passo para rodar o dentist-system na máquina (Mac e Windows).

## Pré-requisitos

- **Docker Desktop** — [mac.install.guide/docker](https://docs.docker.com/desktop/install/mac-install/) | [Windows](https://docs.docker.com/desktop/install/windows-install/)
- **Node.js ≥ 22.13** — recomendado via [fnm](https://github.com/Schniz/fnm) ou [nvm](https://github.com/nvm-sh/nvm)
- **pnpm 11** — `npm install -g pnpm@11`

## 1. Instalar dependências

```bash
pnpm install
```

## 2. Configurar variáveis de ambiente

```bash
# Mac / Linux
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

# Windows (PowerShell)
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/web/.env.example apps/web/.env
```

Edite `apps/api/.env` e defina senhas reais para as variáveis `SEED_*` e `JWT_ACCESS_SECRET`.

## 3. Subir o banco de dados

```bash
pnpm db:up
```

Isso sobe um container Postgres 17 na porta **5433** (loopback apenas).  
Dois bancos são criados: `dentist_dev` (desenvolvimento) e `dentist_test` (testes).

Aguarde o healthcheck ficar verde:

```bash
docker compose ps
```

## 4. Aplicar migrations

```bash
pnpm db:migrate
```

## 5. Popular banco de desenvolvimento

```bash
pnpm db:seed:dev
```

## 6. Rodar a API e o web

```bash
pnpm dev
```

API em `http://localhost:3000`, web em `http://localhost:5173`.

## 7. Rodar os testes

Antes, aplique as migrations no banco de teste:

```bash
pnpm db:migrate:test
```

Depois, rode a suíte completa:

```bash
pnpm test
```

A suíte e2e usa `TEST_DATABASE_URL` para apontar para `dentist_test`. Se a variável não estiver definida, o padrão `postgresql://postgres:postgres@localhost:5433/dentist_test` é usado.

## 8. Resetar tudo

Apaga o volume e recria os bancos do zero:

```bash
pnpm db:reset
pnpm db:migrate
pnpm db:migrate:test
pnpm db:seed:dev
```

## Referência de scripts

| Script | O que faz |
|---|---|
| `pnpm db:up` | Sobe o container Postgres |
| `pnpm db:down` | Para o container (dados preservados) |
| `pnpm db:reset` | Para + apaga volume + sobe de novo |
| `pnpm db:migrate` | Aplica migrations no banco dev |
| `pnpm db:migrate:test` | Aplica migrations no banco de teste |
| `pnpm db:seed:dev` | Seed no banco dev (APP_ENV=dev) |
| `pnpm db:seed` | Seed padrão (lê DATABASE_URL do .env) |

## Nunca faça

**Não aponte `DATABASE_URL` ou `TEST_DATABASE_URL` para um banco remoto** (Neon, Supabase, Render, hml, prod).

A suíte de testes executa `TRUNCATE ... CASCADE` antes e depois de cada teste. Se a URL apontar para um banco remoto, os dados serão destruídos. A guarda de banco (`db-guard.ts`) rejeita qualquer URL que não seja `localhost` / `127.0.0.1` / `[::1]` ou cujo nome não termine em `_test`, mas a melhor proteção é nunca colocar a URL errada no `.env`.
