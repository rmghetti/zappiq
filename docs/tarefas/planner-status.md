# Tarefas estilo Planner — status do loop

Loop de até 4 sessões. Worktree `~/dev/zappiq-mira`, branch `feat/tarefas-planner`.
Proposta original: artifact "Tarefas: de mural de recados a cabine de comando".

## Sessão 1 (15/07/2026)

### O módulo Tarefas hoje (mapeado no código)

- `GET /api/tasks` (filtro status/dueBefore) e `PUT /api/tasks/:id` (title, description,
  status, dueDate). **Não existe rota de criação**: as 3 origens (`crmAutomationService`,
  `mira/releasesAlerta`, `mira/planoAcao`) criam por dentro. O cliente não cria tarefa.
- `Task.assignedToId` é **coluna morta**: `String?` sem FK, sem include, sem UI.
  Só o `seed.ts` escreve. Toda tarefa em produção nasce sem dono (confirmado: 6 tarefas,
  0 com responsável).
- Tela `/tasks` é lista somente-leitura + botão concluir. Sem detalhe, sem criar, sem tag.

### ACHADO DE SEGURANÇA — a RLS do repo é teatro em produção

O item "fechar a lacuna de RLS em tasks/activities/pipeline_stages" partia de premissa
ERRADA. Não são 3 tabelas esquecidas. A RLS inteira nunca chegou em produção.

**Cadeia de fatos, todos verificados no banco de produção (proj `hwdeezdxyphvxikvgjyf`):**

1. A migração `20260417_rls_multi_tenant` **consta como aplicada** (20/04/2026, sem
   rollback) — e mesmo assim `contacts`, `conversations`, `deals`, `users` estão com
   `relrowsecurity = false` e **zero políticas**.
2. A migração `20260611_maestro_v2_versions_timers` falhou com:
   `Database error code: 42704 — ERROR: role "app_user" does not exist`.
3. `app_user` **não existe** em produção. A PRIMEIRA coisa que a migração de abril faz é
   `CREATE ROLE app_user`. Se ela tivesse rodado, o papel existiria em junho.

   → Conclusão: alguém marcou a migração como aplicada sem executá-la
   (`prisma migrate resolve --applied`, caminho que o próprio log sugere). O SQL da RLS
   nunca rodou. Isso explica os 3 fatos de uma vez.

4. A aplicação conecta como **`postgres`**, que tem `rolbypassrls = true` E é **dono** das
   tabelas (`force_rls = false`). Ou seja, **mesmo onde a RLS está ligada, ela é ignorada
   para a API** — duas vezes.

   Prova direta: conectado como `postgres`, com `app.current_organization_id` NULO, um
   `SELECT COUNT(*) FROM mira_alvos` devolve **17**. Se a RLS valesse para essa conexão,
   a política compararia `organizationId = NULL` e devolveria **0**.

5. O próprio `rlsTenant.ts` documenta a pré-condição violada:
   *"RLS só é enforced para o role app_user. Se a aplicação conectar como
   superuser/postgres, as policies são bypassed. Em produção, a connection string deve
   usar o role app_user."*

### O buraco de verdade: a chave anon lê dado de cliente

`anon` **não** tem bypassrls. E tem grant de `SELECT, INSERT, UPDATE, DELETE, TRUNCATE`
em `tasks`, `contacts`, `activities`, `pipeline_stages`, `mira_alvos`.

Onde a RLS está desligada, a chave anon (que é **pública**, vai no bundle do frontend) lê
tudo. Provado por HTTP no PostgREST de produção, pedindo só contagem (sem baixar PII):

| tabela            | HTTP | linhas legíveis pelo anon |
|-------------------|------|---------------------------|
| `contacts`        | 206  | **38** (nome, telefone, e-mail) |
| `pipeline_stages` | 206  | 105                       |
| `activities`      | 206  | 49                        |
| `tasks`           | 206  | 6                         |
| `mira_alvos`      | 200  | **0** ← RLS ligada barra  |

`mira_alvos` é o GRUPO DE CONTROLE e prova as duas pontas:
- RLS + política **barra o anon** (0 linhas), e
- **não quebra a API** (a Mira lê os 17 alvos em produção hoje, porque `postgres` bypassa).

Isto é exposição de dado pessoal de cliente do cliente → relevante para LGPD.

### Não há vazamento entre clientes VIA API

Os 10 pontos que usam `withTenant` filtram por `organizationId` na aplicação
(`contacts.ts`, `auditLogs.ts`, `messages.ts`). O isolamento hoje depende 100% disso.

O risco é o convite: os comentários dizem *"defesa em profundidade — RLS já filtra"* e o
`withTenant` afirma *"RLS policy faz o trabalho mesmo sem"*. **É falso em produção.** Quem
acreditar e omitir o filtro cria vazamento real.

### Ligar RLS nas tabelas do Tarefas é seguro

- API conecta como `postgres` → bypassa → não sente (provado por `mira_alvos`).
- O front só usa Supabase para auth e para `signups`/`organizations`/`tenant_usage_monthly`,
  sempre em rota de servidor com chave de serviço. **Nada legítimo lê `tasks`/`contacts`/
  `activities`/`pipeline_stages` pela chave anon.**

### Feito nesta sessão

- Branch `feat/tarefas-planner`.
- Schema: `TaskStatus += IN_PROGRESS`; `Task += notes, assignedTo (FK real), tags`;
  novos `TaskTag` (catálogo por org, `@@unique([organizationId, name])`) e `TaskTagOnTask`.
  `prisma validate` OK.
- FK de `assignedToId` verificada como segura em produção: 6 tarefas, 0 com responsável,
  0 órfã → criar a FK não quebra a migração.

### BURACO FECHADO — decisão do Rodrigo: "fechar o buraco inteiro primeiro"

Migração `20260715000004_rls_fecha_anon`, APLICADA EM PRODUÇÃO em 15/07/2026.
31 tabelas: RLS ligada em todas; política de tenant nas 15 com `organizationId` direto
(+ `organizations` por `id`); RLS sem política (nega-tudo) nas 15 sem coluna de tenant.

**Prova 1 — o buraco fechou.** Mesmo teste HTTP com a chave pública, depois:

| tabela | antes | depois |
|---|---|---|
| `contacts` | 38 | **0** |
| `pipeline_stages` | 105 | **0** |
| `activities` | 49 | **0** |
| `tasks` | 6 | **0** |
| `conversations`, `deals`, `users`, `messages`, `organizations`, `kb_chunks`, `llm_call_logs`, `discount_coupons` | — | **0** |

**Prova 2 — produção não quebrou.** Igualmente obrigatória, e a que exigiu navegador:
- Como `postgres` (papel da API), sem org setada: contacts 38, conversations 25,
  messages 322, deals 34, users 37, tasks 6, mira_alvos 17 → bypass intacto.
- `/health` HTTP 200; `/api/tasks` sem token HTTP 401 (auth viva, não 500 de banco).
- Chrome logado (org MACHIA): **Contatos renderiza os 4 contatos**, **Tarefas renderiza as
  3 pendentes**. Conversas vazia — e isso está CERTO: a org MACHIA tem 0 conversas no
  banco (conferido por SQL, não presumido).

Não existe papel de pooler `postgres.<ref>`; só `postgres`, com `rolbypassrls=true`.
Descartados antes de aplicar: nenhum uso legítimo de anon em tabela pública (o único
cliente anon do front só chama `exchangeCodeForSession`); sem Realtime no código e a
publicação `supabase_realtime` está VAZIA.

**Armadilha registrada:** `get_page_text` leu "0 contatos" porque rodou antes dos dados
chegarem. O screenshot mostrou 4. Quase reportei que tinha quebrado produção. Em tela que
busca dado, screenshot > texto.

### Ainda aberto (não é deste loop)

- `app_user` continua sem existir. As políticas de tenant seguem inertes para a API, que
  bypassa como `postgres`. Isolamento entre clientes hoje depende 100% do filtro
  `organizationId` na aplicação — que está em todos os 10 pontos de `withTenant`.
- Os comentários do código (`"defesa em profundidade — RLS já filtra"`, `"RLS policy faz o
  trabalho mesmo sem"`) são FALSOS em produção e convidam alguém a omitir o filtro.
  Corrigir o texto é dívida aberta.

Ver memória `zappiq-supabase-rls-desligada` (o achado é de lá; esta sessão descobriu a
CAUSA, provou que a correção era segura e fechou).
