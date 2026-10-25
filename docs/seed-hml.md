# Seed HML

## O que é

O seed HML popula o banco `hml` (Neon, branch `hml`) com personas de teste fixas para validação manual no front (`https://dentist-hml.vitorsantos.dev.br`). Todas as organizações têm prefixo `[SEED-HML]` no nome.

**O seed sempre apaga e recria os dados (orgs `[SEED-HML]` apenas). Não há opção de preservar dados existentes.** Rodar duas vezes produz o mesmo estado final.

## Como rodar

1. Garanta que o GitHub Environment `hml` tem os secrets necessários definidos (ver tabela abaixo).
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

| Email | Papéis | colorToken | Para testar |
|---|---|---|---|
| `admin-a@hml.demo` | ADMIN | BRAND | Fundador; acesso total |
| `dentista-a@hml.demo` | DENTIST | SUCCESS | Papel puro; vê só próprios pacientes/agenda |
| `dentista-b-inativo@hml.demo` | DENTIST | WARNING | **Inativo** — login bloqueado; histórico de agendamentos visível |
| `recepcao-a@hml.demo` | RECEPTIONIST | — | Agenda e pacientes sem criação de usuários |
| `admin-dentista@hml.demo` | ADMIN + DENTIST | INFO | União de papéis; pode agendar para si via ADMIN |
| `dentista-recepcao@hml.demo` | DENTIST + RECEPTIONIST | ERROR | ⚠️ known-bug (PR A pendente) |

Consultórios:
- **Consultório A1** (OWN, colorToken BRAND, ativo) — usado nos agendamentos principais
- **Consultório A2** (OWN, colorToken SUCCESS, ativo)
- **Consultório A3 (inativo)** (RENTED, colorToken ERROR, **inativo**)

Pacientes (12):
- p01–p09: ativos com dono (p01–p04 e p08–p09 owner=dentista-a; p05–p07 owner=admin-dentista)
- p04: compartilhado com `admin-dentista@hml.demo` via `PatientShare`
- p10: **sem dono** (para testes de claim)
- p11, p12: **inativos**

Agendamentos criados (datas relativas ao dia do seed):

| ID | Status | Quando | Dentista | Observação |
|---|---|---|---|---|
| `shhml_apt_a_p35` | SCHEDULED | −35 dias, 10:00 | dentista-a | Borda da janela de 42 dias |
| `shhml_apt_a_p30_inativo` | DONE | −30 dias, 14:00 | dentista-b-inativo | Histórico do dentista inativo |
| `shhml_apt_a_p28` | DONE | −28 dias, 09:00 | dentista-a | |
| `shhml_apt_a_p21` | DONE | −21 dias, 14:00 | dentista-a | |
| `shhml_apt_a_p14` | NO_SHOW | −14 dias, 11:00 | dentista-a | |
| `shhml_apt_a_p7` | CANCELED | −7 dias, 15:00 | dentista-a | |
| `shhml_apt_a_p5_inativo` | DONE | −5 dias, 10:00 | dentista-b-inativo | Segundo histórico do dentista inativo |
| `shhml_apt_a_p3_admindent` | SCHEDULED | −3 dias, 10:00 | admin-dentista | ADMIN+DENTIST agendando no passado |
| `shhml_apt_a_f3` | SCHEDULED | +3 dias, 09:00 | dentista-a | |
| `shhml_apt_a_f7` | SCHEDULED | +7 dias, 10:00 | dentista-a | |
| `shhml_apt_a_overlap_a` | SCHEDULED | +10 dias, 10:00–11:00 | dentista-a | **Par sobreposto intencional** |
| `shhml_apt_a_overlap_b` | SCHEDULED | +10 dias, 10:30–11:30 | dentista-a | **Par sobreposto intencional** |
| `shhml_apt_a_touch_a` | SCHEDULED | +12 dias, 09:00–10:00 | dentista-a | **Par encostado** (fim==início do próximo, sem conflito) |
| `shhml_apt_a_touch_b` | SCHEDULED | +12 dias, 10:00–11:00 | dentista-a | **Par encostado** |
| `shhml_apt_a_f14` | SCHEDULED | +14 dias, 11:00 | dentista-a | |
| `shhml_apt_a_f21` | SCHEDULED | +21 dias, 14:00 | dentista-a | |
| `shhml_apt_a_f28_admindent` | SCHEDULED | +28 dias, 09:00 | admin-dentista | |
| `shhml_apt_a_brt_night` | SCHEDULED | amanhã 23:00 BRT | dentista-a | Testa fuso América/São_Paulo |

### `[SEED-HML] Clínica Demo B` (tipo CLINIC)

| Email | Papéis | Para testar |
|---|---|---|
| `admin-b@hml.demo` | ADMIN | Fundador Org B |
| `dentista-c@hml.demo` | DENTIST | Isolamento cross-org |

Consultório: **Consultório B1** (OWN, colorToken INFO, ativo)

Pacientes: **Paciente B1 Demo**, **Paciente B2 Demo**, **Paciente B3 Demo** (todos ativos)

Agendamentos: 1 SCHEDULED (+5 dias), 1 DONE (−10 dias)

Usada para testes de **isolamento cross-org**.

### `[SEED-HML] Freelancer Demo` (tipo FREELANCER)

| Email | Papéis | colorToken | Para testar |
|---|---|---|---|
| `freelancer@hml.demo` | ADMIN + DENTIST | SUCCESS | Fundador; eixo de agenda por consultório |

Consultórios:
- **Consultório Bragança Demo** (OWN, colorToken BRAND, ativo)
- **Consultório Atibaia Demo** (RENTED, R$150/dia, colorToken WARNING, ativo)

Pacientes (4):
- **Paciente F1 Demo** e **Paciente F2 Demo**: owner=freelancer
- **Paciente F3 Demo (sem dono)** e **Paciente F4 Demo (sem dono)**: `ownerDentistId null` — para testes de claim em org FREELANCER

Agendamentos: 2 SCHEDULED (em Bragança +4d e Atibaia +8d), 1 DONE (Bragança −5d), 1 CANCELED (Atibaia −12d)

## Arquitetura do script

`apps/api/prisma/scripts/seed-hml-personas.ts` exporta:

- `validateNeonHost(varName, urlOverride?)` — pura, sem side effects; usada nos testes unitários.
- `resetHmlSeed(prisma)` — deleta dados `[SEED-HML]` em ordem RESTRICT-safe.
- `seedHmlPersonas(prisma)` — guarda + reset + criação de dados + resumo de contagens.

Registros de orgs, usuários e clínicas têm IDs determinísticos (`shhml_*`) via upsert. Pacientes e agendamentos são recriados do zero a cada execução (após o reset).

O `seed.ts` chama `seedHmlPersonas` quando `APP_ENV=hml` (via `chooseSeed` em `seed-dispatch.ts`).
