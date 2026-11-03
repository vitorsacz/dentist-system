# Go-Live — Bootstrap de Prod

Checklist para onboarding dos primeiros clientes reais: um dentista freelancer e uma clínica.

Execute na ordem abaixo. Cada seção pressupõe que a seção anterior foi concluída.

---

## 1. Pré-requisitos

- Deploy de prod concluído e health check verde (`PROD_API_URL/health` retorna `appEnv == "prod"`).
- Acesso ao painel Super Admin de prod (URL de prod + rota `/admin` ou equivalente).
- Acesso ao painel do Supabase de prod para disparar backup manual antes de qualquer alteração de dados.

---

## 2. Backup manual pré-bootstrap

Antes de criar qualquer organização em prod, tire um snapshot do banco.

**Supabase dashboard:**

1. Acesse o projeto de prod no [Supabase dashboard](https://supabase.com/dashboard).
2. Vá em **Database → Backups**.
3. Clique em **Create a new backup** (ou **Trigger a manual backup**, dependendo do plano).
4. Aguarde o status mudar para `Completed`.
5. Anote o timestamp do backup — útil como ponto de restauração de referência.

> O Supabase faz backups diários automáticos; o manual garante um ponto limpo imediatamente antes das criações.

---

## 3. Troca de senha do Super Admin

Troque a senha do Super Admin antes de criar as organizações, para garantir que nenhuma credencial temporária persiste.

1. Faça login no painel de prod com a credencial atual.
2. Vá em **Configurações de conta** (ou perfil do Super Admin).
3. Altere a senha para uma senha forte e única, não usada em nenhum outro serviço.
4. Encerre todas as sessões ativas após a troca.
5. Guarde a nova senha em um gerenciador de senhas — **não registre em commits, issues, PRs, chats ou docs do repositório**.

---

## 4. Bootstrap — Organização FREELANCER

O dentista freelancer opera sozinho, sem recepcionista ou sócios.

**No painel Super Admin:**

1. Crie uma nova organização com `type = FREELANCER` (ou equivalente no schema).
2. Preencha os dados cadastrais: nome do profissional, CRO, e-mail de contato.
3. Crie o usuário proprietário da organização com role `OWNER`.
4. Envie as credenciais de primeiro acesso por canal seguro (não por e-mail em texto plano se possível — prefira link de definição de senha).
5. Anote o `organizationId` gerado — útil para suporte.

**Validar:**

- Login com o novo usuário funciona.
- O usuário vê apenas dados da própria organização (isolamento multi-tenant).
- Nenhum dado de outras organizações aparece nas listagens.

---

## 5. Bootstrap — Organização CLÍNICA

A clínica pode ter múltiplos dentistas e recepcionistas.

**No painel Super Admin:**

1. Crie uma nova organização com `type = CLINIC` (ou equivalente).
2. Preencha os dados cadastrais: razão social, CNPJ, e-mail administrativo.
3. Crie o usuário administrador da clínica com role `OWNER` ou `ADMIN`.
4. Envie as credenciais de primeiro acesso por canal seguro.
5. Anote o `organizationId` gerado.

**O administrador da clínica deve:**

- Trocar a senha no primeiro login.
- Convidar os demais profissionais (dentistas, recepcionistas) pelos roles corretos.

**Validar:**

- Login do admin da clínica funciona.
- O admin consegue criar usuários adicionais dentro da própria organização.
- Os usuários adicionais veem apenas dados da clínica deles.

---

## 6. Smoke pós-bootstrap

Execute após criar as duas organizações.

| Verificação | Esperado |
|---|---|
| `GET PROD_API_URL/health` | `appEnv == "prod"`, `version` == SHA promovido |
| Login freelancer | 200, token retornado |
| Login clínica (admin) | 200, token retornado |
| Listagem de pacientes (freelancer) | Retorna apenas dados do freelancer |
| Listagem de pacientes (clínica) | Retorna apenas dados da clínica |
| Login freelancer com credencial da clínica | 401 / erro de autenticação |
| Acesso a rota de outra org com token válido | 403 / erro de autorização |

Qualquer falha no isolamento multi-tenant é **bloqueante** — não ative os clientes antes de resolver.

---

## 7. Pós-ativação

- Comunique os clientes que o acesso está disponível.
- Monitore os logs do Render (dentist-system-api) nas primeiras 24h.
- O próximo backup automático do Supabase ocorrerá em até 24h; confirme no dashboard que ele completou com sucesso.
