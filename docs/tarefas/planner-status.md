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

## Sessão 2 (15/07/2026) — fundação de dados e API

Migração `20260715000005_tarefas_planner` (escrita, NÃO aplicada — vai pelo
`migrate deploy` do Fly na sessão 4). Tudo aditivo: nenhuma linha existente muda.
- `TaskStatus += IN_PROGRESS` (`ADD VALUE` roda em transação no PG 17 porque o
  valor não é USADO na mesma migração).
- `tasks.notes` (observação do humano, separada da `description` da IA).
- FK real em `assignedToId → users(id) ON DELETE SET NULL` (a tarefa é da org, não
  de quem saiu). Seguro: 6 tarefas, 0 com responsável, 0 órfã em produção.
- `task_tags` (catálogo, `@@unique([organizationId, name])`) + `task_tags_on_tasks`.
- RLS já nas tabelas novas: tabela nova nasce fechada, senão reabriria o buraco
  que a 20260715000004 acabou de fechar.

API: `POST /` (não existia — o cliente não criava tarefa), `GET /:id` (painel),
`GET /tags` + `POST /tags` + `PUT /tags/:id` + `DELETE /tags/:id` (catálogo),
`PUT /:id` estendido (notes, assignedToId, tagIds). Filtros novos no `GET /`:
`tagId`, `assignedToId` (aceita `me` e `none`), `origem`.

Decisões que valem registro:
- **`validarVinculos`**: todo id vindo do cliente (assignedToId/contactId/dealId/
  tagIds) é conferido contra a org ANTES de gravar. Nenhum é validável pelo
  formato — cuid de outra org passa no zod. A checagem de etiqueta é por
  CONTAGEM (2 pedidas, 1 achada → recusa o lote); "achou alguma" deixaria a
  etiqueta alheia entrar de carona.
- **`origem` fora do contrato**: se o cliente pudesse mandar, forjaria tarefa com
  selo "Prospecção" da Mira.
- **`/tags` declarado ANTES de `/:id`**: o Express casa na ordem e `/tasks/tags`
  bateria em `/tasks/:id` com id="tags".
- **id inválido no filtro é IGNORADO**, não vira filtro: filtrar por lixo daria
  lista vazia e o cliente leria "não tenho tarefa" (mentira) em vez de "meu
  filtro não valeu".
- **`me` resolvido no servidor**: quem sabe quem está logado é ele.

Verificação: `tsc` exit 0. Suíte inteira da API **162 arquivos / 1666 testes,
zero falha** (36 novos: 24 puros + 12 de isolamento de tenant).

### Ainda aberto (não é deste loop)

- `app_user` continua sem existir. As políticas de tenant seguem inertes para a API, que
  bypassa como `postgres`. Isolamento entre clientes hoje depende 100% do filtro
  `organizationId` na aplicação — que está em todos os 10 pontos de `withTenant`.
- Os comentários do código (`"defesa em profundidade — RLS já filtra"`, `"RLS policy faz o
  trabalho mesmo sem"`) são FALSOS em produção e convidam alguém a omitir o filtro.
  Corrigir o texto é dívida aberta.

Ver memória `zappiq-supabase-rls-desligada` (o achado é de lá; esta sessão descobriu a
CAUSA, provou que a correção era segura e fechou).

## Sessões 3 e 4 (15/07/2026) — tela, deploy e prova

PR #305 (mergeada) + PR #306 (fix do z-index). Fly v373, Vercel Production Ready.

### O bug que só o navegador pega (de novo)

O FAB "Treinar <agente>" é `fixed bottom-6 right-6 z-50` — o MESMO z-index do
painel. Empatados, decide a ordem do DOM, e o FAB ganhava: ficava por cima de
**Salvar** e **Cancelar**. Na prática a pessoa abria a tarefa, preenchia tudo e
NÃO CONSEGUIA SALVAR.

`tsc` exit 0 e 56 testes de tarefas verdes com o bug no ar. Nenhum teste vê dois
elementos empilhados. Mesma lição do loop anterior (a frase sem sentido que 16
testes verdes não pegaram). **Feature de tela não está pronta até abrir a tela.**

### Deploy: quase parei no meio sem ver

O `flyctl deploy` falhou com timeout de health check (erro de rede da API do
Fly). `release_command completed successfully` → **a migração rodou**. Mas as
máquinas ficaram DIVIDIDAS: uma na v371 (velha, servindo) e outra na v372 (nova,
parada). `/health` devolvia 200 — pela máquina VELHA. Se eu tivesse checado só o
health, teria declarado deploy OK com produção pela metade.
O que salvou: a migração ser ADITIVA (código velho roda com banco novo).
Segundo `flyctl deploy` fechou o rolling update: ambas na v373.

### Efeito da migração conferido no banco (não o registro)

A lição desta sessão aplicada em si mesma: `_prisma_migrations` diz que aplicou;
o banco diz se aplicou.

| verificação | resultado |
|---|---|
| enum `TaskStatus` | `PENDING,IN_PROGRESS,DONE,CANCELLED` ✓ |
| `tasks.notes` | existe ✓ |
| FK `tasks_assignedToId_fkey` | existe ✓ |
| `task_tags` | existe, RLS LIGADA ✓ |

### E2E em produção (Chrome logado, org MACHIA)

Fluxo real exercitado: abrir "Ver tarefa" → criar etiqueta "Urgente" → marcar →
escrever observação → Salvar. Persistido e conferido por SQL:
`notes` gravado, `Urgente (#9333ea)` vinculado, org = MACHIA (tenant certo).
Anon nas tabelas novas: `task_tags` 0, `task_tags_on_tasks` 0, `tasks` 0.

**Dado de teste limpo depois:** a observação era INVENTADA por mim para o teste
(uma afirmação sobre uma pessoa real que ninguém apurou). Removida junto com o
vínculo da etiqueta. A etiqueta "Urgente" ficou no catálogo (rótulo, não fato).
Estado final: 6 tarefas, 0 observações, 0 vínculos, 1 etiqueta no catálogo.

## NÃO ENTREGUE (decisão consciente, não esquecimento)

- **Quadro Kanban** — o `TASK_BOARD_COLUMNS` já existe e está testado na API,
  mas a tela do quadro não foi feita.
- **Integrações** com CRM (aba no contato/negócio), Impulso (aprovação do
  Co-Piloto virando tarefa) e link de volta para a conversa.

Cabiam 4 sessões e uma foi inteira para a segurança. Preferi entregar provado o
que o Rodrigo pediu explicitamente a entregar tudo pela metade.

---

# Loop 2 — Kanban + integrações (16/07/2026)

Continuação pedida pelo Rodrigo depois do encerramento do Loop 1. Branch
`feat/tarefas-kanban-integracoes`. Máx. 4 sessões, seguido de um loop de
verificação de até 4 sessões antes de considerar tudo encerrado.

## Sessão 1 — fundação de API

Agente de exploração mapeou os 3 pontos de encaixe antes de qualquer código
(ver resumo abaixo). Implementado:

- **`GET /api/tasks?contactId=&dealId=`**: faltava só o código — campos e
  índices já existiam no model. Mesmo padrão de validação/ignorar-lixo dos
  outros filtros.
- **`Task.conversationId`**: o `TaskPanel` já tinha o link "ver a conversa"
  pronto na intenção; o dado nunca tinha sido persistido.
  `crmAutomationService.ts` já recebia `conversationId` e já o usava nas
  `Activity` vizinhas — uma linha fechou.
- **`Task.campaignId` + Tarefa de aprovação do Impulso**: `POST /api/impulso`
  agora cria uma Task quando a campanha nasce (DRAFT ou SCHEDULED — os dois
  únicos status de criação). Serviço puro `impulsoAprovacao.ts` decide
  quando e monta título/descrição, testável sem Prisma.

### Decisão de segurança que vale destacar

O "Co-Piloto" (autonomyLevel padrão 2, "IA propõe, humano aprova") era só um
campo no schema — nada no código o lia. O cron (`campaignSchedulerCron.ts`)
dispara campanha `SCHEDULED` sem checar aprovação nenhuma.

**A Tarefa criada é LEMBRETE, não TRAVA.** Concluí-la não publica a campanha;
deixá-la pendente não impede o cron de disparar. Fazer a aprovação travar o
disparo de verdade mudaria o comportamento de envio de campanha de **cliente
pago** em produção — isso é decisão de produto que precisa de sinal explícito
do Rodrigo, não inferência de "melhor recomendação" dentro de um loop
autônomo. Documentado no topo de `impulsoAprovacao.ts` para quem ler o código
depois não presumir que a aprovação já trava algo.

Migração `20260715000006_tarefas_conversa_campanha` (aditiva). `tsc` exit 0.
Suíte da API: 166 arquivos / 1696 testes verdes (30 novos).

## Pendente (próximas sessões)

- Tela do quadro Kanban (`TASK_BOARD_COLUMNS` já pronto e testado na API).
- Seção "Tarefas" no `DealDrawer.tsx` (padrão já existe: seção "Atividades").
- Página de detalhe do Contato (`app/(dashboard)/contacts/[id]/page.tsx`) —
  **não existe hoje**. O link `/contacts/${id}` que o `TaskPanel` já usa dá
  404 em produção agora mesmo; construir esta página fecha um bug real, não
  só entrega a "aba de tarefas" pedida.
- Descrição de tarefa `origem: IMPULSO` também deveria ser somente-leitura no
  painel (mesmo tratamento hoje dado a `origem: MIRA`) — ajuste pequeno de
  front, ainda não feito.
