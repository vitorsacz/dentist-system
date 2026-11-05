# Checklist de Promoção para Produção

Execute na ordem abaixo antes e depois de cada promoção via `deploy.yml`.
O checklist complementa `docs/deploy-flow.md` (fluxo CI/CD) e `docs/go-live.md` (bootstrap de orgs).

---

## 1. Pré-promoção

### 1.1 Backup Supabase

Disponível apenas no plano **Pro**. No plano gratuito, avalie o risco antes de prosseguir.

```
Supabase dashboard → Database → Backups → Trigger a manual backup
```

Aguarde `Completed` e anote o timestamp antes de continuar.

### 1.2 Constraints NOT VALID pendentes de VALIDATE

Constraints adicionadas com `NOT VALID` não protegem dados existentes até serem validadas.
Execute a query abaixo em prod **antes** de promover, para verificar se há validações pendentes:

```sql
SELECT conname, conrelid::regclass AS tabela
FROM pg_constraint
WHERE convalidated = false
  AND contype = 'f';
```

Resultado vazio = tudo ok. Resultado não-vazio = execute os `VALIDATE CONSTRAINT` listados
na seção **2.2** antes de mergear qualquer release que dependa da integridade dessas FKs.

---

## 2. Durante o deploy (automático)

O `buildCommand` do Render executa `prisma migrate deploy` automaticamente.
Não há ação manual aqui — o workflow aguarda o health check de prod (`appEnv == "prod"`).

---

## 3. Pós-deploy

### 3.1 VALIDATE CONSTRAINT pendentes

Execute imediatamente após `prisma migrate deploy` concluir em prod.
A query da seção 1.2 lista quais constraints precisam de VALIDATE.

#### Histórico de constraints NOT VALID

| Migration | Tabela | Constraint | VALIDATE incluído? |
|---|---|---|---|
| `20261104000000_hawk_h1_anamnesis_structured` | `Anamnesis` | `Anamnesis_updatedByUserId_fkey` | Sim — `20261105000001_cap_validate_anamnesis_fk` |
| `20261104020000_hawk_anamnesis_questions` | `AnamnesisQuestion` | `AnamnesisQuestion_organizationId_fkey` | **Não** — validar manualmente |

Para a FK `AnamnesisQuestion_organizationId_fkey`, execute em prod após o deploy:

```sql
ALTER TABLE "AnamnesisQuestion"
  VALIDATE CONSTRAINT "AnamnesisQuestion_organizationId_fkey";
```

Acesso: Supabase dashboard → SQL Editor, ou via `psql $DIRECT_URL`.

Após validar, adicione uma migration de VALIDATE para registrar no histórico:

```bash
# No repo, crie a migration:
pnpm --filter @dentist-system/api prisma migrate dev \
  --name cap_validate_anamnesis_question_fk \
  --create-only
# Adicione ao arquivo gerado:
#   ALTER TABLE "AnamnesisQuestion" VALIDATE CONSTRAINT "AnamnesisQuestion_organizationId_fkey";
# Aplique em prod no próximo deploy.
```

### 3.2 Smoke post-deploy

Ver tabela de smoke em `docs/go-live.md` §6. Os itens mínimos:

```
GET PROD_API_URL/health  →  appEnv == "prod", version == SHA promovido
```

---

## 4. Primeiro go-live (executar uma vez)

Aplique apenas na primeira promoção para prod com clientes reais. Para re-deploys, pule esta seção.

### 4.1 Rotação de senha do Super Admin

Ver `docs/go-live.md` §3 para o procedimento completo.

Resumo:
1. Login em `/platform` com credencial atual.
2. Troque a senha (localização exata a confirmar com o roteiro de onboarding do CAP).
3. Encerre todas as sessões ativas após a troca.
4. Guarde a nova senha em gerenciador de senhas — **nunca em commits, issues, PRs ou docs**.

### 4.2 Bootstrap de organizações

Ver `docs/go-live.md` §4–§5 para criar as orgs FREELANCER e CLINIC e validar isolamento multi-tenant.

---

## 5. Referências

| Documento | Conteúdo |
|---|---|
| `docs/deploy-flow.md` | Fluxo CI/CD, rollback, Expand/Contract |
| `docs/go-live.md` | Bootstrap de orgs, smoke completo, pós-ativação |
