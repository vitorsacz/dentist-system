# Go-Live — Bootstrap de Prod

Checklist para onboarding dos primeiros clientes reais: um dentista freelancer e uma clínica.

Execute na ordem abaixo. Cada seção pressupõe que a seção anterior foi concluída.

---

## 1. Pré-requisitos

- Deploy de prod concluído e health check verde (`PROD_API_URL/health` retorna `appEnv == "prod"`).
- Acesso ao painel Super Admin de prod (URL de prod + rota `/platform`).
- Acesso ao painel do Supabase de prod (backup depende de plano — ver seção 2).

---

## 2. Backup pré-bootstrap

O backup automático diário e o backup manual são recursos do plano **Pro** do Supabase. No plano gratuito não existem.

- Se o projeto de prod estiver no plano Pro: Supabase dashboard → **Database → Backups → Trigger a manual backup**. Aguarde `Completed` e anote o timestamp.
- Se estiver no plano gratuito: o backup depende de upgrade para Pro antes do go-live. Avalie o risco de prosseguir sem ponto de restauração.

---

## 3. Troca de senha do Super Admin

Troque a senha do Super Admin antes de criar as organizações, para garantir que nenhuma credencial temporária persiste.

1. Faça login em `/platform` com a credencial atual.
2. Acesse as configurações do Super Admin. *(Localização exata a confirmar com o roteiro de onboarding do CAP.)*
3. Altere a senha para uma senha forte e única, não usada em nenhum outro serviço.
4. Encerre todas as sessões ativas após a troca.
5. Guarde a nova senha em um gerenciador de senhas — **não registre em commits, issues, PRs, chats ou docs do repositório**.

---

## 4. Bootstrap — Organização FREELANCER

O dentista freelancer opera sozinho. A organização é do tipo `FREELANCER`; o usuário fundador tem role `ADMIN`.

**No painel `/platform`:**

1. Crie uma nova organização com `type = FREELANCER`.
2. Preencha os dados cadastrais: nome do profissional, CRO, e-mail de contato.
3. Crie o usuário fundador com role `ADMIN`.
4. Envie as credenciais de primeiro acesso por canal seguro. *(Fluxo de envio e link de definição de senha a confirmar com o roteiro de onboarding do CAP.)*
5. Anote o `organizationId` gerado — útil para suporte.

**Validar:**

- Login com o novo usuário funciona.
- O usuário vê apenas dados da própria organização (isolamento multi-tenant).
- Nenhum dado de outras organizações aparece nas listagens.

---

## 5. Bootstrap — Organização CLÍNICA

A clínica pode ter múltiplos dentistas e recepcionistas. Roles disponíveis: `ADMIN`, `DENTIST`, `RECEPTIONIST`.

**No painel `/platform`:**

1. Crie uma nova organização com `type = CLINIC`.
2. Preencha os dados cadastrais: razão social, CNPJ, e-mail administrativo.
3. Crie o usuário fundador com role `ADMIN`.
4. Envie as credenciais de primeiro acesso por canal seguro. *(Fluxo de envio a confirmar com o roteiro de onboarding do CAP.)*
5. Anote o `organizationId` gerado.

**O administrador da clínica deve:**

- Trocar a senha no primeiro login.
- Adicionar os demais profissionais (`DENTIST`, `RECEPTIONIST`) pelos roles corretos. *(Fluxo de adição de usuários adicionais a confirmar com o roteiro de onboarding do CAP.)*

**Validar:**

- Login do admin da clínica funciona.
- Os usuários adicionados veem apenas dados da clínica deles.

---

## 6. Smoke pós-bootstrap

Execute após criar as duas organizações.

| Verificação | Esperado |
|---|---|
| `GET PROD_API_URL/health` | `appEnv == "prod"`, `version` == SHA promovido |
| Login freelancer | 200, sessão criada (refresh em cookie) |
| Login clínica (admin) | 200, sessão criada (refresh em cookie) |
| Listagem de pacientes (freelancer) | Retorna apenas dados do freelancer |
| Listagem de pacientes (clínica) | Retorna apenas dados da clínica |
| Login freelancer com credencial da clínica | 401 / erro de autenticação |
| Acesso a rota de outra org com token válido | 403 / erro de autorização |

Qualquer falha no isolamento multi-tenant é **bloqueante** — não ative os clientes antes de resolver.

---

## 7. Pós-ativação

- Comunique os clientes que o acesso está disponível.
- Monitore os logs do Render (dentist-system-api) nas primeiras 24h.
- Se o projeto estiver no plano Pro: confirme no Supabase dashboard que o próximo backup automático (diário) completou com sucesso.
