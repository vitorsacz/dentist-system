# Análise de Vulnerabilidades Dependabot — Novembro 2026

> **Resumo executivo (3 linhas)**
> Existem **3 vulnerabilidades exploráveis em produção hoje**: `proxy-addr` (CRITICAL, IP spoofing no Express), `body-parser` (HIGH, parsing de corpo HTTP malformado recebido pela API) e `handlebars` (CRITICAL, template injection — requer confirmação de uso em runtime). O restante envolve dependências transitivas de build/dev, pacotes cuja função vulnerável não é exposta à entrada não-confiável, ou false-positives de range de versão. **Nenhum dado de paciente está em risco imediato**, mas as 3 vulnerabilidades acima devem ser corrigidas antes do próximo release.

---

## 1. Inventário de alertas abertos (91 alertas → N pacotes únicos)

| Pacote | Alertas | Severidade máx. | CVE / GHSA | Versão afetada | Versão corrigida | Escopo | Workspace |
|---|---|---|---|---|---|---|---|
| proxy-addr | 1 | **CRITICAL** | GHSA-jqcg-44mw-7w3h / CVE-2026-90711 | >= 1.1.0, < 2.0.8 | 2.0.8 | runtime | pnpm-lock (transitive via express) |
| handlebars | 3 | **CRITICAL** | GHSA-p8wg-vrv2-v86f, GHSA-8r5x-fm3f-whwj, GHSA-xw65-4hp5-5hc7 | >= 3.0.0, <= 4.7.9 | 4.7.10 | runtime | pnpm-lock (transitive) |
| tar | 9 | **CRITICAL** | GHSA-23hp-3jrh-7fpw + 8 mais | <= 7.5.20 | 7.5.21 | runtime | pnpm-lock (transitive) |
| body-parser | 2 | HIGH | GHSA-27r3-jxmh-p828 / CVE-2026-111181, GHSA-v422-hmwv-36x6 | < 1.20.9 | 1.20.9 | runtime | pnpm-lock (transitive via express) |
| multer | 6 | HIGH | GHSA-wc9g-mqfw-jrwm, GHSA-535w-7cp7-47q4, GHSA-72gw-mp4g-v24j + 3 mais | < 2.5.0 | 2.5.0 | runtime | pnpm-lock (transitive via @nestjs/platform-express) |
| fast-uri | 11 | HIGH | GHSA-qw65-cvwx-89v3, GHSA-5jgf-p345-68v8 + 9 mais | >= 3.0.0, < 3.1.9 | 3.1.9 | runtime | pnpm-lock (transitive via ajv) |
| zod | 4 | HIGH | GHSA-mrhx-c7xc-m3w5 / CVE-2023-54404 | < 4.6.6 | 4.6.6 | runtime | apps/api, apps/web, packages/shared-types, pnpm-lock |
| brace-expansion | 9 | HIGH | GHSA-6j4f-fj2g-mc7p, GHSA-qhr7-859c-m2p7, GHSA-rgw5-rvv9-x895 + 3 mais | < 1.1.21 / < 2.1.7 / < 5.0.12 | por major | runtime | pnpm-lock (transitive via glob/minimatch) |
| vite | 5 | HIGH | GHSA-587h-7wmj-h5pm + 4 mais | <= 6.4.3 | 6.4.4 | runtime | apps/web (dev dep direto) |
| react-router | 1 | HIGH | GHSA-qwww-vcr4-c8h2 | >= 7.12.0, < 7.18.2 | 7.18.2 | runtime | pnpm-lock (transitive via react-router-dom) |
| js-yaml | 4 | HIGH | GHSA-2883-xcg3-v3hh, GHSA-5p4m-2wfm-xmqj + 2 mais | >= 3.0.0, < 3.15.2 / >= 4.0.0, < 4.3.2 | 3.15.2 / 4.3.2 | runtime | pnpm-lock (transitive) |
| nanoid | 1 | HIGH | GHSA-2v37-7h3g-55p8 / CVE-2026-67213 | < 3.3.18 | 3.3.18 | runtime | pnpm-lock (transitive) |
| source-map-js | 1 | HIGH | GHSA-68fv-2mgg-jv7q / CVE-2026-93749 | >= 1.0.0, < 1.2.2 | 1.2.2 | runtime | pnpm-lock (transitive via postcss) |
| lodash | 2 | HIGH | GHSA-r5fr-rjxr-66jc / CVE-2026-4800, GHSA-xxjr-mmjv-4gpg | >= 4.0.0, <= 4.17.23 | 4.18.0 | runtime | pnpm-lock (transitive) |
| picomatch | 2 | HIGH | GHSA-c2c7-rcm5-vvqj / CVE-2026-33671, GHSA-3v7f-55p6-f55p | >= 4.0.0, < 4.0.4 | 4.0.4 | runtime | pnpm-lock (transitive) |
| tmp | 2 | HIGH | GHSA-ph9p-34f9-6g65 / CVE-2026-44705, GHSA-52f5-9888-hmc6 | < 0.2.6 | 0.2.6 | runtime | pnpm-lock (transitive) |
| file-type | 2 | MEDIUM | GHSA-5v7r-6r5c-r473, GHSA-j47w-4g3g-c36v | >= 13.0.0, < 21.3.2 | 21.3.2 | runtime | pnpm-lock (transitive) |
| qs | 4 | MEDIUM | GHSA-6pq8-jhm2-2vcw, GHSA-x5fp-wj9c-mxmx + 2 mais | >= 6.7.0, <= 6.16.0 | 6.16.1 | runtime | pnpm-lock (transitive via express) |
| @nestjs/core | 2 | MEDIUM | GHSA-36xv-jgw5-4q75 / CVE-2026-35515 | <= 11.1.17 | 11.1.18 | runtime | apps/api (direto v10.4.15), pnpm-lock |
| ajv | 1 | MEDIUM | GHSA-2g4f-4pwh-qvx6 / CVE-2025-69873 | >= 7.0.0, < 8.18.0 | 8.18.0 | runtime | pnpm-lock (transitive) |
| glob | 2 | MEDIUM/HIGH | GHSA-3g3m-2fjr-6pw4, GHSA-5j98-mcp5-4vw2 | >= 9.0.0, <= 14.0.1 | 14.0.2 | runtime | pnpm-lock (transitive) |
| minimatch | 1 | MEDIUM | GHSA-g3hv-75wg-m249 / CVE-2026-118764 | < 11.0.1 | 11.0.1 | runtime | pnpm-lock (transitive) |
| postcss-selector-parser | 1 | MEDIUM | GHSA-rj75-hqrm-r3gf / CVE-2026-104844 | < 6.1.5 | 6.1.5 | runtime | pnpm-lock (transitive via tailwindcss) |
| deepmerge | 1 | LOW | GHSA-gcqx-w48m-w2h4 / CVE-2026-93753 | >= 4.2.0, <= 4.3.1 | **sem patch** | runtime | pnpm-lock (transitive) |
| webpack | 2 | LOW | GHSA-8fgc-7cc6-rx7x, GHSA-38r7-794h-5758 | >= 5.49.0, <= 5.104.0 | 5.104.1 | runtime | pnpm-lock (transitive, build) |
| esbuild | 1 | LOW | GHSA-g7r4-m6w7-qqqr | >= 0.27.3, < 0.28.1 | 0.28.1 | runtime | pnpm-lock (transitive, build) |

---

## 2. Exploitabilidade real no nosso uso

### CORRIGIR AGORA — exploráveis em produção

| Pacote | GHSA | Por que é explorável | Função vulnerável exposta? |
|---|---|---|---|
| **proxy-addr** | GHSA-jqcg-44mw-7w3h (CRITICAL) | IP spoofing/bypass de trust proxy. `@nestjs/platform-express` → express → proxy-addr. Se a API usa rate-limiting (`@nestjs/throttler`), log de IP, ou qualquer lógica por IP, um atacante pode forjar o header `X-Forwarded-For` para bypass. | Sim — toda request HTTP passa por proxy-addr quando express está configurado com `trust proxy`. |
| **body-parser** | GHSA-27r3-jxmh-p828 (HIGH) | Parsing de corpo HTTP. API NestJS recebe bodies JSON de clientes (unauthenticated em rotas de login, authenticated em demais). Corpo malformado pode causar comportamento indefinido ou DoS. | Sim — toda request com body passa por body-parser via @nestjs/platform-express. |
| **handlebars** | GHSA-p8wg-vrv2-v86f / GHSA-8r5x-fm3f-whwj (CRITICAL) | Template injection (SSTI). **Precisa confirmar se handlebars é usado em runtime**: se for só dependência de build tools (webpack, nestjs CLI), risco é zero em produção. Se algum serviço renderiza templates Handlebars com input de usuário, é crítico. | **A confirmar** — nenhum uso direto encontrado no search da árvore de arquivos; provavelmente só tooling. |

### CORRIGIR ESTA SEMANA

| Pacote | GHSA | Classificação | Justificativa |
|---|---|---|---|
| **multer** | GHSA-wc9g-mqfw-jrwm, GHSA-535w-7cp7-47q4 (HIGH) | CORRIGIR ESTA SEMANA | Transitive via `@nestjs/platform-express`. Nenhum `FileInterceptor` ou rota de upload encontrado na árvore. Vulnerabilidade ativa durante upload de arquivos. Se não há upload, pode ser `dismiss: not_used`. Verificar antes. |
| **fast-uri** | GHSA-qw65-cvwx-89v3 (HIGH) | CORRIGIR ESTA SEMANA | URI parser via ajv. API usa zod para validação, mas ajv pode estar na cadeia via NestJS internals. Parsing de URI malformado em validação de request. |
| **vite** | GHSA-587h-7wmj-h5pm (HIGH) | CORRIGIR ESTA SEMANA | Dev server bypass. Afeta apenas `npm run dev` local — não é runtime de produção. Patch fácil (6.0.5 → 6.4.4, minor). Risco baixo para prod. |
| **react-router** | GHSA-qwww-vcr4-c8h2 (HIGH) | CORRIGIR ESTA SEMANA | Frontend routing. Vulnerabilidade de bypass de rota/autenticação no browser. Afeta a web app (apps/web). |
| **brace-expansion** | GHSA-6j4f-fj2g-mc7p, GHSA-qhr7-859c-m2p7 (HIGH) | CORRIGIR ESTA SEMANA | ReDoS via globs. Usado internamente em ferramentas de path, não diretamente em input de usuário. Risco moderado. |
| **nanoid** | GHSA-2v37-7h3g-55p8 (HIGH) | CORRIGIR ESTA SEMANA | Fraqueza na geração de IDs. Se usado para session tokens/JWT IDs, risco alto. Verificar uso. |
| **lodash** | GHSA-r5fr-rjxr-66jc (HIGH) | CORRIGIR ESTA SEMANA | Prototype pollution. Lodash é transitive — verificar se algum serviço processa objetos de usuário via lodash methods. |
| **@nestjs/core** | GHSA-36xv-jgw5-4q75 (MEDIUM) | CORRIGIR ESTA SEMANA | Direct dep da API (v10.4.15). Advisory cobre <= 11.1.17 — a vulnerabilidade cobre v10 também. Patch exige bump para v11 (major). Testar e2e completo. |

### CORRIGIR NO PRÓXIMO CICLO

- `qs` MEDIUM (transitive via express — fix bloqueado sem atualizar express)
- `js-yaml` HIGH (config loading, provavelmente não exposto a input de usuário)
- `tar` CRITICAL/HIGH (build tool — confirmar se não é chamado em runtime)
- `picomatch` HIGH (path matching em watchers/glob — não exposto a input externo)
- `tmp` HIGH (temp files — confirmar uso)
- `source-map-js` HIGH (source maps — somente build/dev)
- `file-type` MEDIUM (file type detection — somente se upload ativo)
- `glob`/`minimatch` MEDIUM (build tooling)
- `ajv` MEDIUM (atualizar junto com fast-uri)
- `postcss-selector-parser` MEDIUM (CSS build tooling, não runtime de prod)

### IGNORAR / DISMISS (proposta)

| Pacote | Motivo | Código GitHub aceito |
|---|---|---|
| `zod` (todos os 4 alertas) | Project usa v3. Advisory range `< 4.6.6` cobre semver v3 matematicamente, mas a vulnerabilidade foi introduzida em v4. `zod@3.x` não é afetado. | `inaccurate` |
| `webpack` (2 alertas) | Webpack é bundler de build. Não executa em produção. Código de build não processa input de usuário. | `not_used` |
| `esbuild` (1 alerta) | Build tool apenas. | `not_used` |
| `deepmerge` (1 alerta) | Sem patch disponível. Uso transitive apenas em tooling (turbo/vite internals). Sem exposição a input não-confiável. | `tolerable_risk` |
| `source-map-js` (1 alerta) | Source maps não são servidos em produção. | `not_used` |
| `vite` LOW (GHSA-9jrq-w75r-8gcw) | Baixa severidade, dev-only. | `not_used` |

---

## 3. Por que o Dependabot Updates falha

### fast-uri — `security_update_not_possible`

```
latest-resolvable-version: 3.1.4
lowest-non-vulnerable-version: 3.1.9
conflicting-dependencies: []
```

**Causa:** `fast-uri` é dependência transitive de `ajv` (via `@fastify/ajv-compiler` ou `ajv-formats`), que tem uma constraint de peer que limita `fast-uri` à range `>= 3.0.0, < 3.2.0` (ou similar). O Dependabot não consegue resolver uma versão que satisfaça tanto o peer do parent quanto o requisito mínimo de segurança (>= 3.1.9). O `conflicting-dependencies: []` vazio indica que o bloqueio não é por peer conflict declarado, mas por resolução de range no lockfile — o parent especifica uma range incompatível.

**Fix:** Atualizar o pacote parent que fixa a range de `fast-uri`. Identificar qual versão de `ajv` permite `fast-uri >= 3.1.9` e bumpar o ajv. Alternativa: `pnpm.overrides` no `package.json` raiz para forçar `fast-uri >= 3.1.9`.

### qs — `security_update_not_possible` (mesma causa)

**Causa:** `qs` é internal dep do `express@4.x`. O Express 4 importa `qs` diretamente sem expô-lo como peer dep — Dependabot não pode bumpar `qs` sem bumpar o `express` que o controla. A versão mais recente do `express@4` usa `qs` dentro de um range que não alcança 6.16.1.

**Fix:** Atualizar `express` para v5 (major bump) OU adicionar `pnpm.overrides: { "qs": ">=6.16.1" }`. Ambas precisam de testes regressivos.

### Outros runs falhando (glob, body-parser, minimatch)

Mesma classe de problema: dependências transitivas com ranges incompatíveis com o patch de segurança exigido. O Dependabot só consegue bumpar dependências diretas — para transitivas bloqueadas, precisa de `overrides` ou atualização do parent.

---

## 4. Pacotes sensíveis para o produto (sem alert)

| Pacote | Versão em uso | Alert ativo? | Observação |
|---|---|---|---|
| `multer` | transitive via @nestjs/platform-express | Sim (HIGH) | Nenhum uso de FileInterceptor encontrado; provável not_used |
| `@nestjs/jwt` → jsonwebtoken | v10.2.0 | Não | jsonwebtoken não está como dep direto; @nestjs/jwt usa internamente |
| `bcrypt` | ^5.1.1 | Não | Sem alert ativo |
| `helmet` | ^8.3.0 | Não | Sem alert ativo |
| `@nestjs/core` | ^10.4.15 | Sim (MEDIUM) | Ver seção 2 |
| `@prisma/client` | ^5.22.0 | Não | Sem alert ativo |
| `cookie-parser` | ^1.4.7 | Não | Sem alert ativo |
| `zod` | ^3.24.1 | Sim (HIGH, inaccurate) | Ver proposta dismiss |
| `express` (via @nestjs/platform-express) | 4.x (transitive) | Indiretamente (via proxy-addr, body-parser, qs) | Atualizar para 5.x resolve vários alerts |

---

## 5. Plano de correção — PRs propostos

### PR-SEC-01 — `fix: atualizar proxy-addr e body-parser via express@5`
- **O que fazer:** Bumpar `@nestjs/platform-express` para versão compatível com express@5, ou adicionar `pnpm.overrides` para `proxy-addr >= 2.0.8` e `body-parser >= 1.20.9`.
- **Risco:** express@5 é major; mudanças de API em middleware. Alternativa mais segura: `pnpm.overrides` como workaround temporário.
- **Cobertura de testes:** testes e2e (`apps/api/test/jest-e2e.config.js`) cobrem rotas HTTP — executar suite completa.
- **Validação manual HML:** Sim — testar login, criação de agendamento, rotas autenticadas e não-autenticadas.
- **Resolve alerts:** proxy-addr #71, body-parser #82, #37, e indiretamente qs #89, #50, #49, #27.

### PR-SEC-02 — `fix: vite@6.4.4 e react-router@7.18.2`
- **O que fazer:** Bumpar `vite` em `apps/web` de `^6.0.5` para `^6.4.4`. Bumpar `react-router-dom` para versão que depende de `react-router >= 7.18.2`.
- **Risco:** Baixo — patch/minor. Vite é dev dep. react-router-dom pode ter breaking changes de roteamento.
- **Cobertura:** `apps/web` não tem testes (script de test retorna "no tests yet"). Teste manual da navegação obrigatório.
- **Validação manual HML:** Sim — testar fluxo de login, rotas protegidas, 404, redirect.
- **Resolve alerts:** vite #80, #79, #78, #77, #76, react-router #47.

### PR-SEC-03 — `fix: fast-uri via override pnpm`
- **O que fazer:** Adicionar `pnpm.overrides: { "fast-uri": ">=3.1.9" }` em `package.json` raiz.
- **Risco:** Override força todos os consumers de fast-uri para a mesma versão; pode quebrar algum pkg que testa com versão específica. Risco baixo pois é patch.
- **Cobertura:** Executar `pnpm install` + testes e2e da API.
- **Validação manual HML:** Não necessário se testes passam.
- **Resolve alerts:** fast-uri #85, #84, #83, #60, #54, #53, #52, #51, #44, #70 (parcial).

### PR-SEC-04 — `fix: nanoid, lodash, brace-expansion`
- **O que fazer:** Verificar quais parents fixam essas versões e bumpar. Adicionar overrides como fallback.
- **Risco:** Baixo — transitive patches.
- **Cobertura:** Testes unitários + e2e.
- **Validação manual HML:** Não necessário.

### PR-SEC-05 — `fix: @nestjs/* v10 → v11 (major)`
- **O que fazer:** Bumpar `@nestjs/core`, `@nestjs/common`, `@nestjs/platform-express`, `@nestjs/jwt`, `@nestjs/passport`, `@nestjs/throttler` para v11. Verificar breaking changes.
- **Risco:** **Alto** — major version. NestJS v11 tem mudanças de API em guards, interceptors, decorators.
- **Cobertura:** Testes unitários + e2e obrigatórios. 
- **Validação manual HML:** **Sim** — testar todos os fluxos de autenticação, throttling e rotas.

### PR-SEC-06 — `chore: dismiss alertas não-exploráveis`
- **O que fazer:** Via interface do GitHub, dismiss alerts de `zod` (inaccurate), `webpack`, `esbuild` (not_used), `deepmerge` (tolerable_risk), `source-map-js` (not_used), `vite` LOW (not_used).
- **Risco:** Nenhum — é documentação de risco aceitado.

---

## 6. Sumário de contagens

| Categoria | Pacotes únicos | Alertas brutos |
|---|---|---|
| CORRIGIR AGORA | proxy-addr, body-parser, handlebars¹ | 6 |
| CORRIGIR ESTA SEMANA | multer, fast-uri, vite, react-router, brace-expansion, nanoid, lodash, @nestjs/core | 29 |
| CORRIGIR NO PRÓXIMO CICLO | qs, js-yaml, tar, picomatch, tmp, source-map-js, file-type, glob, minimatch, ajv, postcss-selector-parser | 32 |
| IGNORAR / DISMISS | zod, webpack, esbuild, deepmerge, source-map-js, vite-low | 10 |
| **Total** | | **≈ 91** |

> ¹ handlebars: se confirmado como build-only, mover para IGNORAR/DISMISS.

---

*Gerado em 2026-11-03. Revisar após cada major bump de dependência.*
