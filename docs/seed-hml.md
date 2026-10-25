# Seed HML

## O que é

O seed HML popula o banco `hml` (Neon, branch `hml`) com personas de teste fixas para validação manual no front (`https://dentist-hml.vitorsantos.dev.br`). Todas as organizações têm prefixo `[SEED-HML]` no nome.

**O seed reseta tudo antes de criar** — rodar duas vezes produz o mesmo estado final.

## Como rodar

1. Garanta que o GitHub Environment `hml` tem o secret `SEED_HML_PASSWORD` definido (mínimo 12 caracteres).
2. No GitHub: **Actions → Seed HML → Run workflow**.
3. O workflow deleta todos os dados `[SEED-HML]` e recria do zero.

> **Nunca rodar manualmente a partir da máquina local contra o banco HML.**
> O script valida que `DATABASE_URL` e `DIRECT_URL` apontam para `neon.tech`
> e que `APP_ENV=hml` — rejeita qualquer outra URL (Supabase, localhost, etc.).

## Segredos necessários no GitHub Environment `hml`

| Secret | Descrição |
|---|---|
| `HML_DATABASE_URL` | Transaction pooler URL do Neon (branch `hml`) |
| `HML_DIRECT_URL` | Session pooler URL do Neon (branch `hml`) |
| `SEED_HML_PASSWORD` | Senha de todas as personas de teste (mín. 12 chars) |

## Personas criadas

Todas usam a senha definida em `SEED_HML_PASSWORD`.

### `[SEED-HML] Clínica Demo A` (tipo CLINIC)

| Email | Papéis | Observação |
|---|---|---|
| `admin-a@hml.demo` | ADMIN | Fundador |
| `dentista-a@hml.demo` | DENTIST | Ativo |
| `dentista-b-inativo@hml.demo` | DENTIST | **Inativo** — testa histórico e bloqueio de login |
| `recepcao-a@hml.demo` | RECEPTIONIST | |
| `admin-dentista@hml.demo` | ADMIN + DENTIST | Testa união de papéis |
| `dentista-recepcao@hml.demo` | DENTIST + RECEPTIONIST | ⚠️ known-bug (PR A pendente) |

Consultório: **Consultório Demo A** (OWN, colorToken BRAND)

Pacientes: **Paciente Ativo Demo** e **Paciente Inativo Demo** (active: false)

Agendamentos pré-criados (datas relativas ao dia do seed):

| ID de referência | Status | Quando | Dentista |
|---|---|---|---|
| `shhml_apt_scheduled` | SCHEDULED | +2 dias, 09:00 | dentista-a |
| `shhml_apt_done` | DONE | -7 dias, 10:00 | dentista-a |
| `shhml_apt_canceled` | CANCELED | -3 dias, 14:00 | dentista-a |
| `shhml_apt_noshow` | NO_SHOW | -1 dia, 11:00 | dentista-a |
| `shhml_apt_hist_inativo` | DONE | -14 dias, 15:00 | dentista-b-inativo |

### `[SEED-HML] Clínica Demo B` (tipo CLINIC)

| Email | Papéis | Observação |
|---|---|---|
| `admin-b@hml.demo` | ADMIN | Fundador |
| `dentista-c@hml.demo` | DENTIST | |

Usada para testes de **isolamento cross-org**.

### `[SEED-HML] Freelancer Demo` (tipo FREELANCER)

| Email | Papéis | Observação |
|---|---|---|
| `freelancer@hml.demo` | ADMIN + DENTIST | Fundador |

Consultórios: **Consultório Bragança Demo** (OWN) e **Consultório Atibaia Demo** (RENTED, R$150/dia)

Paciente: **Paciente Freelancer Demo**

## Arquitetura do script

`apps/api/prisma/scripts/seed-hml-personas.ts` exporta:

- `validateNeonHost(varName, urlOverride?)` — pura, sem side effects; usada nos testes unitários.
- `resetHmlSeed(prisma)` — deleta dados `[SEED-HML]` em ordem RESTRICT-safe.
- `seedHmlPersonas(prisma)` — guarda + reset + criação de dados.

Todos os registros têm IDs determinísticos (`shhml_*`) — re-executar é idempotente via upsert.

O `seed.ts` chama `seedHmlPersonas` quando `APP_ENV=hml` (via `chooseSeed` em `seed-dispatch.ts`).
