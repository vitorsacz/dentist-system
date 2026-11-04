# QA — Jornadas HML — Novembro 2026

**Agente**: HULK  
**Data**: 2026-11-03  
**Commit HML**: 677e23fc  
**API**: https://dentist-system-api-hml.onrender.com  

---

## Jornada 1 — FREELANCER

Persona: `freelancer@hml.demo` (ADMIN + DENTIST, Org F)

| # | Passo | Esperado | Obtido | Status | Evidência |
|---|---|---|---|---|---|
| 1 | Login `freelancer@hml.demo` | 200 + accessToken | 200 + accessToken | ✅ | `{"accessToken":"eyJ..."}` |
| 2 | Trocar senha (`PATCH /users/:id/password`) | 200 | 200 | ✅ | `{"userId":"shhml_u_freelancer","email":"freelancer@hml.demo"}` |
| 3 | Login com nova senha | 200 | 200 | ✅ | token_ok=yes |
| 4 | Reverter senha original | 200 | 200 | ✅ | HTTP 200 |
| 5 | `GET /clinics` — Bragança + Atibaia presentes | 200 + 2 clínicas | 200 + `['Consultório Atibaia Demo', 'Consultório Bragança Demo']` | ✅ | count=2 |
| 6 | `POST /clinics` — criar consultório novo | 201 | 201 | ✅ | `{"id":"cmw1hvh140001a6li..."}` |
| 7 | `PUT /clinics/shhml_c_atibaia/financial-terms` | 200/201 | 200 | ✅ | `{"relationshipType":"RENTED_FIXED","rentValue":150}` |
| 8 | `GET /clinics` — inclui o novo | 200 + ≥3 | 200 + count=3 | ✅ | `['Atibaia Demo', 'Bragança Demo', 'Consultório QA Test']` |
| 9 | `POST /patients` | 201 | 201 | ✅ | `{"id":"cmw1hw904..."}` |
| 10 | `PUT /patients/:id/anamnesis` | 200 | 200 | ✅ | `{"allergies":"nenhuma","medications":"nenhum"}` |
| 11 | `POST /appointments` Bragança +2d 09:00 | 201 | 201 | ✅ | `{"id":"cmw1hwswq..."}` |
| 12 | `POST /appointments` Atibaia +2d 14:00 (mesmo dia) | 201 (sem conflito) | 201 | ✅ | `{"id":"cmw1hwxxk..."}` |
| 13 | `GET /appointments?from=...&to=...` (janela 42d) | 200 + ≥2 | 200 + count=6 | ✅ | count=6 (inclui seed) |
| 14 | `GET /appointments` sem params | 400 (schema requer from/to) | 400 | ✅ comportamento esperado | `{"fieldErrors":{"from":...}}` |
| 15 | `POST /attendances` com todos os campos | 201 | 201 | ✅ | `{"id":"cmw1hymq9..."}` |
| 16 | `GET /reports/financial` (ADMIN+DENTIST) | 200 | 200 | ✅ | `{"clinics":[{"clinicId":"shhml_c_braganca","grossRevenue":250}]}` |
| 17 | Exportar CSV (`GET /reports/financial/export`) | 200 + CSV | 404 | ❌ **FALHA** | `{"message":"Cannot GET /reports/financial/export"}` |
| 18 | Dashboard (`GET /dashboard` ou `/reports/dashboard`) | 200 | 404 | ❌ **FALHA** | endpoint não existe |
| 19 | Auditoria (`GET /audit-logs`) | 200 | 404 | ❌ **FALHA** | endpoint não existe |

> **Nota J1.3**: schema de troca de senha é `{password: string}` (reset admin-style); não exige senha atual. Qualquer usuário com permissão pode alterar — ADMIN pode alterar qualquer user da org.  
> **Nota J1.10**: `POST /attendances` exige `procedureId` (procedure catalog não é pre-populado no seed — necessário criar via `POST /procedures` antes).

---

## Jornada 2 — CLÍNICA (Org A)

Personas: `admin-a@hml.demo` (ADMIN), `dentista-a@hml.demo` (DENTIST), `recepcao-a@hml.demo` (RECEPTIONIST), `admin-dentista@hml.demo` (ADMIN+DENTIST), `admin-b@hml.demo` (ADMIN, Org B)

| # | Passo | Esperado | Obtido | Status | Evidência |
|---|---|---|---|---|---|
| 1 | Login `admin-a@hml.demo` | 200 | 200 | ✅ | token_ok=yes |
| 2 | `POST /users` DENTIST novo | 201 | 201 | ✅ | `{"userId":"cmw1hzu2x...","email":"dentista-novo@hml.demo"}` |
| 3 | `POST /users` RECEPTIONIST nova | 201 | 201 | ✅ | `{"userId":"cmw1hzwjt...","email":"recepcao-nova@hml.demo"}` |
| 4 | Login `recepcao-a@hml.demo` | 200 | 200 | ✅ | token_ok=yes |
| 5 | Recepção agenda para dentista-a (+5d 09:00-10:00) | 201 | 201 | ✅ | `{"id":"cmw1i0axz..."}` |
| 6 | Login `dentista-a@hml.demo` | 200 | 200 | ✅ | token_ok=yes |
| 7 | Dentista vê própria agenda (escopo isolado) | 200, só dentistUserId=shhml_u_dent_a | 200, count=11, dentistas={'shhml_u_dent_a'} | ✅ | escopo correto |
| 8 | Dentista passa `?dentistUserId=shhml_u_admin_dent` | 200 mas retorna próprios dados (param ignorado) | 200, retorna dados de dentista-a | ✅ seguro | serviço sobrescreve pelo actor.id |
| 9 | Dentista vê próprio financeiro | 200 | 200, clinics=[], totals zerados | ✅ | sem atendimentos registrados para dentista-a |
| 10 | Login `admin-a@hml.demo` | 200 | 200 | ✅ | — |
| 11 | Admin vê financeiro consolidado | 200 | **403** | ❌ **FALHA** | `{"message":"Sem permissão para acessar este recurso"}` |
| 12 | Conflito de horário (mesmo slot do passo 5) | 409 SCHEDULE_CONFLICT | 409 | ✅ | `{"code":"SCHEDULE_CONFLICT","conflicts":[...]}` |
| 13 | `allowOverlap=true` como ADMIN | 201 | 201 | ✅ | ADMIN pode sobrepor |
| 14 | `allowOverlap=true` como DENTIST | 403 | 403 | ✅ | `{"message":"allowOverlap não permitido para DENTIST"}` |
| 15 | Paciente compartilhado — admin-dentista acessa P_A_04 | 200 | 200 | ✅ | `{"name":"Paciente 04 Demo A"}` |
| 16 | Isolamento cross-org — admin-b tenta P_A_01 | 403 ou 404 | 404 | ✅ | `{"message":"Paciente não encontrado"}` |
| 17 | Odontograma `GET /patients/:id/tooth-records` | 200 | 200 | ✅ | `[]` (sem registros, endpoint funciona) |
| 18 | `POST /budgets` como admin-a | 201 | **403** | ❌ **FALHA** | `{"message":"Sem permissão para acessar este recurso"}` |
| 19 | Suspensão da org pelo Super Admin | 200 (se endpoint existe) | 404 | ❌ **FALHA** | `{"message":"Cannot PATCH /platform/organizations/.../suspend"}` |
| 20 | Login `dentista-b-inativo@hml.demo` | 401 (inativo não loga) | 401 | ✅ | `{"message":"Credenciais inválidas"}` |

> **Nota J2.11**: `admin-dentista@hml.demo` (ADMIN+DENTIST) CONSEGUE acessar `reports/financial` pois tem o role DENTIST. Apenas usuários com role ADMIN puro não conseguem.

---

## Falhas encontradas

| ID | Severidade | Área | Descrição resumida |
|---|---|---|---|
| F-01 | P1 | PANTHER | ADMIN puro (sem DENTIST) não acessa `GET /reports/financial` — `ACCESS["reports.financial"]` falta `"ADMIN"` |
| F-02 | P1 | PANTHER | ADMIN não cria orçamentos — `ACCESS["budgets.write"]` falta `"ADMIN"` |
| F-03 | P1 | PANTHER | Sem endpoint de exportação CSV (`GET /reports/financial/export`) |
| F-04 | P1 | SPIDEY | Sem endpoint de dashboard |
| F-05 | P2 | VISION | Sem endpoint de auditoria de organização |
| F-06 | P2 | CAP | Sem endpoint de suspensão/reativação de org pelo Super Admin (`/platform/organizations/:id/suspend`) |

---

## Veredito

**NÃO APTO** para os 2 clientes.

**Bloqueadores P1**:
1. **F-01** — ADMIN não vê relatório financeiro consolidado (bloqueia jornada CLÍNICA completa)
2. **F-02** — ADMIN não cria orçamento (bloqueia funcionalidade core para gerentes de clínica)
3. **F-03** — Sem exportação CSV (bloqueia jornada FREELANCER)
4. **F-04** — Sem dashboard (bloqueia jornada FREELANCER)

**Bloqueadores P2** (pré-produção):
5. **F-05** — Sem auditoria
6. **F-06** — Sem suspensão de org

---

## Issues abertos

Ver issues `#QA` em vitorsacz/dentist-system.
