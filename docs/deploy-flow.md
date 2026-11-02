# Deploy Flow — HML → Produção

## Fluxo

```
push → main ──┬──► Render HML  (dentist-system-api-hml)  auto-deploy
              └──► Vercel HML  (dentist-system-web-hml)   auto-deploy
                        │
                        │  smoke ok + checks verdes + aprovação manual
                        ▼
              gh workflow run deploy.yml [--field sha=<SHA>]
                        │
                        │  environment "prod" (required reviewer)
                        ▼
              branch `production` avança para SHA (fast-forward)
                        │
              ┌─────────┴─────────┐
              ▼                   ▼
      Render prod            Vercel prod
  (dentist-system-api)  (dentist-system-web)
      auto-deploy             auto-deploy
      via branch:             via Production
      production              Branch: production
```

O workflow verifica, antes de qualquer push:
1. Check `build` verde para o SHA (GitHub Actions CI).
2. Vercel status checks verdes para o SHA (`Vercel – dentist-system-web` e `Vercel – dentist-system-web-hml`).
3. Smoke do HML: `GET HML_API_URL/health` retorna `version == SHA` e `appEnv == "hml"` (retry com backoff, timeout 10 min — cobre cold start do serviço free do Render).

Após o fast-forward da branch `production`:
- Render detecta o push e inicia o deploy da API (inclui `prisma migrate deploy` no buildCommand).
- Vercel detecta o push na Production Branch e deploya o front.
- O workflow aguarda `PROD_API_URL/health` retornar `version == SHA` e `appEnv == "prod"` (timeout 10 min).
- O job summary registra SHA promovido e SHA anterior.

### Serviços e gestão

| Serviço | Plataforma | Branch | Gerenciado por |
|---|---|---|---|
| dentist-system-api | Render | `production` | `render.yaml` (Blueprint) |
| dentist-system-api-hml | Render | `main` | Painel Render (fora do Blueprint) |
| dentist-system-web | Vercel | `production` | Painel Vercel |
| dentist-system-web-hml | Vercel | `main` | Painel Vercel |

O serviço `dentist-system-api-hml` foi criado via API e **não é gerenciado pelo Blueprint** (`render.yaml`). Configurações de variáveis de ambiente e região devem ser feitas pelo painel do Render.

---

## Rollback

O SHA anterior está no job summary de cada execução do workflow.

**Opção 1 — Rollback via workflow (recomendada):**

```
gh workflow run deploy.yml \
  --field sha=<PREV_SHA> \
  --field rollback=true
```

O workflow exige aprovação do environment `prod`, verifica que o SHA é ancestral da `production` atual e faz o push com `--force`. O Render e a Vercel redeployam automaticamente ao detectar o push na branch `production`.

**Opção 2 — Revert commit (histórico limpo):**

Crie um revert commit na `main`, aguarde o deploy no HML, verifique, e promova normalmente (sem `rollback=true`).

**Rollback de código NÃO desfaz migration.** Se uma migration já rodou em prod, o schema do banco já foi alterado. Para desfazer o schema é necessário uma migration de rollback explícita. Ver Política Expand/Contract abaixo.

---

## Política de Migrations — Expand/Contract

### Regra de compatibilidade (deploy conjunto)

A API sobe com a migration e fica disponível antes ou junto com o front. Isso significa que **a versão nova da API precisa funcionar com a versão anterior do front** durante a janela de deploy do Vercel. Projete endpoints e respostas para ser retrocompatíveis na mesma release.

### Expand/Contract para mudanças destrutivas

Migration destrutiva = DROP/RENAME de coluna ou tabela, adicionar NOT NULL sem default em tabela populada, remover campo de resposta de API.

**Nunca aplique uma migration destrutiva no mesmo release que o código que deixa de usar o campo.** Use dois releases:

| Release | Migration | Código |
|---|---|---|
| 1 (expand) | Adiciona coluna nova (nullable ou com default); mantém coluna antiga | Escreve na nova, lê de ambas |
| 2 (contract) | Remove coluna antiga | Lê apenas da nova |

Se o rollback do release 2 ocorrer, a coluna antiga já não existe — isso é esperado. O rollback nunca é automático no banco; só no código/infra.

---

## Checklist — Setup inicial (faça antes de mergear esta PR)

Execute nesta ordem exata. **A branch `production` deve existir antes do merge** — o serviço Render de produção passará a apontar para ela e quebraria no próximo deploy se ela não existisse.

### 1. Criar a branch `production`

```bash
# A partir do SHA atual da main (confirme com `git log --oneline -1 origin/main`)
git fetch origin
git push origin origin/main:refs/heads/production
```

### 2. Proteger a branch `production`

Via GitHub → Settings → Branches (ou Rulesets). Configuração necessária:

- Proibir force push: **sim**
- Proibir deleção: **sim**
- Exigir PR antes de merge: **não** (o workflow faz push direto)
- Bypass para GitHub Actions: **sim** — sem isso o `git push` do workflow falhará com 403

Se usar **Rulesets** (recomendado): adicione um bypass actor "GitHub Actions" (tipo: Integration).
Se usar **Branch Protection clássica**: marque "Allow force pushes" apenas para o workflow via `GITHUB_TOKEN` não é possível diretamente — use Ruleset nesse caso.

### 3. Criar o environment `prod`

GitHub → Settings → Environments → New environment → `prod`:

- Required reviewers: você (`vitorsacz`)
- Variables (não secrets):
  - `HML_API_URL` = URL pública da API HML no Render (ex.: `https://dentist-system-api-hml.onrender.com`)
  - `PROD_API_URL` = URL pública da API prod no Render (ex.: `https://dentist-system-api.onrender.com`)

### 4. Vercel prod — Production Branch

Vercel dashboard → `dentist-system-web` → Settings → Git → **Production Branch** → alterar de `main` para `production`.

### 5. Render prod — confirmar branch

Após o merge desta PR, o Blueprint sincroniza `render.yaml` e atualiza o serviço `dentist-system-api` para `branch: production`. Confirme no painel Render que o serviço passou a apontar para `production`. Se o Blueprint não sincronizar automaticamente, atualize manualmente em Settings → Branch.

### 6. Mergear esta PR

Só após os passos 1–5 concluídos.
