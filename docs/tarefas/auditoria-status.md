# Auditoria — Tarefas + Mira/cupons (loop de até 4 sessões)

Branch `audit/tarefas-mira-cupons`. Tudo já em produção (Fly v378). Objetivo:
achar bug/regressão/vazamento ANTES de considerar encerrado. Provas em produção
> leitura de código.

## Sessão 1 — verificado

### Item 5 — banco de produção (migração + FKs) ✅
Query direta em prod (`hwdeezdxyphvxikvgjyf`):
- `20260715000005` e `20260715000006` ambas aplicadas.
- FKs de Task: `conversationId`/`campaignId`/`assignedToId`/`dealId` = **SET NULL**
  (correto: apagar a origem não apaga a tarefa). `contactId` = **CASCADE**
  (pré-existente, não meu; defensável — tarefa de um contato apagado some).
- `TaskOrigem` = CONVERSA,MIRA,IMPULSO. RLS ligada em `task_tags` e
  `task_tags_on_tasks`.

### Segurança das tabelas novas ✅
Anon (chave pública) → **0 linhas** em `task_tags` e `task_tags_on_tasks`
(HTTP no PostgREST). Nasceram fechadas.

### Item 2 — gate de cobrança do pacote no trial ✅
- `creditMiraPack` é o ÚNICO ponto de crédito de pacote, chamado em UM lugar de
  runtime: o webhook do Stripe (linha 603), só quando uma sessão de checkout de
  pacote completa.
- A única forma de abrir essa sessão é `POST /pack/checkout`, que agora exige
  `ent.access.tier` (trial tem tier null → 403). Caminho "trial→paga→nada"
  fechado na origem.
- Edge remoto e não-regressivo: cliente com faixa inicia checkout e cancela a
  faixa antes do webhook — o crédito cairia no mês corrente; mas isso credita a
  favor dele (recupera se reassinar no mês), não "paga e não recebe". Não é meu
  e não vale perseguir.

### Item 6 — trava anti-esquecimento NÃO é tautologia ✅
Injetei `PRODUTO_FANTASMA_AUDITORIA` (productId no Stripe, ausente do catálogo
comercial). A trava FALHOU exatamente onde deveria, nomeando o culpado.
Restaurado; 7/7 verdes.

### Item 1 — isolamento de tenant nas rotas que CONSTRUÍ ✅ (auditoria adversarial)
Agente confirmou seguros: `validarVinculos` cobre assignedToId/contactId/dealId
(findFirst por org) e tagIds POR CONTAGEM com dedupe (cuid de outra org não
passa); POST valida os 4, PUT valida os 2 que aceita (contactId/dealId nem
entram no schema `.strict()`); rotas `/tags` usam updateMany/deleteMany+org;
`buildTaskListWhere` sempre trava org e não permite override; Task de aprovação
do Impulso usa `campaignId` da campanha criada (não do body); `conversationId`
do follow-up vem do orchestrator (fonte confiável).

## ACHADO — pré-existente, NÃO é deste trabalho, DECISÃO DO RODRIGO

### `POST /api/impulso/pix` — conversationId do cliente sem validação de org
`impulso.ts:349` passa `req.body.conversationId` (pixSchema: só
`z.string().optional()`, sem checar org) direto a `sendReplyText`, que faz
`conversation.findUnique({ where: { id } })` **sem filtro de org**
(`channelDispatcher.ts:39`). Cliente A referencia conversa do cliente B → o
sistema lê o contato do B e tenta enviar a cobrança pelas credenciais do A.

**Impacto real (verificado, não presumido):**
- Cobrança Pix nasce na conta Asaas do A → A não rouba dinheiro do B.
- IG: IGSID é escopado à conta do B → Meta rejeita envio pelas credenciais do A.
- WA: texto livre só entrega na janela de 24h → A não teria com telefone alheio.
- Sem leitura de dado de B na resposta HTTP.

Gravidade real: **baixa-média**. É quebra de isolamento (confia 100% na Meta
downstream), mas sem roubo de dinheiro/PII na prática.

**PRÉ-EXISTENTE:** a rota Pix e o `sendReplyText` são anteriores a este
trabalho. Não vou tocar rota de cobrança/disparo sem o Rodrigo decidir (regra
do loop). Fix proposto (defesa em profundidade, baixo risco): `sendReplyText`
filtrar a conversa por `organizationId` — conserta a rota Pix e qualquer caller
futuro; não muda nada pro caller legítimo (orchestrator sempre passa org+conv
do mesmo turno).

Menor (informativo): `crmAutomationService.ts:209` dedupe de task PENDING sem
`organizationId` — não exploitável (deal.id é cuid único de uma org).

## Pendente sessão 1
- Segundo agente (efeitos colaterais Impulso/cron) ainda rodando.
- Itens 3, 4, 7 a fechar (Impulso não muda cron; Kanban sem regressão; nenhuma
  tela oferece o que a API recusa).

## Sessão 1 — itens 3, 4 (Impulso, via 2º agente) e o fix

### Item 3 — cron/dispatch NÃO mudou ✅
`campaignSchedulerCron.ts` consulta só `{status:'SCHEDULED', scheduledAt<=now}`,
sem join com Task. `dispatchCampaignJob` não lê Task nenhuma. A tarefa de
aprovação é lembrete e não trava o disparo — como decidido. Sem regressão.
(As palavras "aprovado" no queueService são template do WhatsApp, não a Task.)

### Item 4 — Task de aprovação é visível ✅ (com ressalva conhecida)
Nasce sem `assignedToId`, mas aparece em GET /api/tasks (escopo org), sob
`assignedToId=none` e `origem=IMPULSO`. "Pull" funciona (abre /tasks e vê);
"push" (notificar um responsável) continua não existindo — limitação conhecida,
não regressão.

### REGRESSÃO CORRIGIDA (era minha, do #307) — commit bfd349a
`POST /api/impulso`: `campaign.create` e `task.create` eram dois await sem
transação/try-catch. Falha na tarefa → campanha órfã + 500 → cliente repete →
campanha DUPLICADA. Fix fail-soft (try/catch, logger.warn, 201 com a campanha).
Teste trava a regressão e PROVADO que pega (revert → vermelho). tsc 0; API
167/1709 verde. FALTA: PR+CI+merge+deploy.

### Achado menor (2º agente, não meu, não exploitável)
`POST /api/campaigns` (campaigns.ts) cria campanha SCHEDULED que o cron dispara,
sem passar pela task de aprovação (não é Impulso). E o cron não filtra
`isImpulso`. Não é regressão do #307. Registrado, sem ação.

## Estado ao fim da sessão 1
- Itens 1,2,3,4,5,6 auditados. Item 7 (tela não oferece o que a API recusa)
  parcialmente coberto pelas provas em navegador do loop anterior (trial não
  mostra mais pacote).
- 1 fix meu pronto (fail-soft), a mergear/deployar.
- 1 achado pré-existente (Pix cross-tenant) aguardando DECISÃO DO RODRIGO.

## Sessão 2 — encerramento

### Fix da regressão do Impulso: NO AR
PR #311 mergeada, Fly v380 (ambas as máquinas, health 200). O fail-soft está em
produção.

### Item 7 — nenhuma tela oferece o que a API recusa ✅
- Mira trial: provado no loop anterior (esgotado → oferece faixa, não pacote).
- Perfil do Contato (a página nova que fechou o 404): renderiza no ar, seção
  Tarefas filtra por contactId (o perfil do LUIZ mostra só as 3 dele, esconde
  METALURGICA/GISLAINE de outros contatos), painel "Nova tarefa" abre limpo com
  o "Criar tarefa" acessível (z-index mantido). O contactId pré-vinculado é da
  própria org do usuário → a API nunca recusa (seguro por construção).
- Banco conferido: sem resíduo dos meus testes (METALURGICA voltou a PENDING,
  0 notes/etiquetas de teste; as 2 DONE são históricas).

## VEREDITO DA AUDITORIA

Os 7 itens auditados. Tudo que foi CONSTRUÍDO nas duas frentes está sólido:
isolamento de tenant correto em todas as rotas novas, cobrança do pacote
fechada na origem, migração/FKs certas, trava anti-esquecimento provada
não-tautológica, cron do Impulso inalterado, telas coerentes com a API.

**1 regressão encontrada e CORRIGIDA** (fail-soft do Impulso, minha, do #307).

**1 achado PRÉ-EXISTENTE aguardando decisão do Rodrigo:** POST /api/impulso/pix
não valida a org do conversationId (gravidade baixa-média, não é deste
trabalho, rota de cobrança). Fix proposto pronto; não aplicado por ser rota de
cobrança fora do escopo.

Nada mais a auditar nas frentes Tarefas e Mira/cupons.
