# Treinar IA e Qualidade da IA: plano para cumprir o que prometem

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: `superpowers:subagent-driven-development` (um implementador por tarefa, revisão de conformidade e de qualidade antes de fundir). Cada tarefa vira um PR próprio, numa worktree própria (`~/dev/zappiq-wt-<slug>`), com testes que rodam no CI. Marque as caixas (`- [ ]`) ao concluir.

**Objetivo:** fazer o Treinar IA e a Qualidade da IA entregarem exatamente o que a interface promete, na ordem que protege o cliente real primeiro (CMJ tem treinamento em 18/09/2026), sem ambiente de homologação: rede de segurança antes, mudança de comportamento atrás de interruptor por organização, prova por consulta ou por Raio-X (sem LLM) antes de ligar para o cliente.

**Arquitetura:** monorepo pnpm (`apps/api` Express + Prisma no Fly, `apps/web` Next.js na Vercel, `services/rag` FastAPI no Fly, Postgres 17 + pgvector no Supabase, projeto `hwdeezdxyphvxikvgjyf`). Fundir na `main` faz deploy da API (Fly) e do web (Vercel); o RAG só sobe por `workflow_dispatch`. Toda mudança de comportamento do agente entra atrás de `org_feature_flags` (padrão desligado) e é provada pelo Raio-X antes de ser ligada por organização, na ordem: STAGING como fixture, MACHIA (Marcia), Iza, CMJ (Vera).

**Fonte da verdade:** laudo da auditoria de 13/09/2026 (https://claude.ai/code/artifact/278db05b-1310-4b66-9ec5-a84fafa379b8). Os ids `Annn` abaixo são os achados do laudo; `Pnn` são as propostas. Decisões do fundador em 14/09/2026: plano aprovado na íntegra, recomendações da síntese valem como padrão.

**Regras que valem em todas as tarefas**
- Português do Brasil com acentuação em todo texto que o cliente lê; nunca o caractere de travessão (`—`) em texto novo.
- TDD: teste que falha, implementação mínima, teste verde, commit. Teste que prova comportamento, não mock que só confirma que a função existe.
- Nada de segredo no código, no log ou no chat. Nada de chamada de LLM em teste.
- Tabela nova nasce com `ENABLE ROW LEVEL SECURITY` e `REVOKE ALL ... FROM anon, authenticated` na própria migração.
- Rota nova de cliente escopa por `organizationId` (padrão `loadAgentScoped`); rota de admin exige `requireRole('SUPERADMIN')`.
- Migração de dado em produção: sempre com `dry-run` que imprime o que vai mudar, snapshot do estado anterior (tabela de versões ou arquivo), e recusa de gravação suja (padrão de `services/promptRemediationService.ts`).
- Cada PR descreve a PROVA que aceitamos e como ela foi obtida.

---

## Onda A (rede de segurança e o que afeta cliente real hoje)

### Tarefa A1: rede de segurança do deploy e dependências do caminho do treino
Branch `feat/rede-de-seguranca`. Resolve A122, A021, A054, A255, A196 (parte), A018 (alinhamento), P71.

**Arquivos**
- Modificar: `.github/workflows/fly-deploy.yml`, `.github/workflows/ci.yml`, `.github/dependabot.yml`
- Criar: `osv-scanner.toml` (raiz; exceções com id, motivo, dono e prazo)
- Modificar: `apps/api/package.json` (multer 2.x, axios >= 1.20, socket.io atual com engine.io >= 6.6.7; remover `@anthropic-ai/sdk` se `grep -rn "@anthropic-ai/sdk" apps/api/src` não achar uso), `pnpm-lock.yaml`
- Modificar: `apps/api/src/middleware/errorHandler.ts` (MulterError vira 4xx em português), `apps/api/src/routes/aiTraining.ts` (fileFilter com erro tipado 415)
- Criar: `apps/api/src/middleware/errorHandler.test.ts`
- Modificar: `services/rag/requirements.txt` (python-multipart >= 0.0.31; fastapi e uvicorn recentes com starlette corrigido), `services/rag/fly.toml` ([env] `EMBEDDING_PROVIDER=openai`, `EMBEDDING_MODEL=text-embedding-3-small`, `EMBEDDING_DIM=1536`, comentário explicando que é o que roda em produção e que a coluna é vector(1536)), `docs/architecture/embeddings.md` (decisão: OpenAI 1536 é o provedor oficial)

**Comportamento**
1. `fly-deploy.yml`: o job `build-check` passa a rodar lint, `tsc --noEmit` da api e do web, `pnpm --filter @zappiq/api test` (com `DATABASE_URL` e `JWT_SECRET` fictícios como no ci.yml), `pnpm --filter @zappiq/shared test`, `pnpm --filter @zappiq/web test` e o build. Sem `|| true` em nenhum passo. O smoke de saúde da API e do RAG deixa de ter `continue-on-error`; o smoke do RAG falha se `/ready` não devolver `checks.embedding.provider == "openai"` e `model == "text-embedding-3-small"`.
2. `ci.yml`: `pnpm audit --prod --audit-level=high` e `pip-audit --strict` sem `|| true`; job novo `osv` com `google/osv-scanner-action` (fixar em tag ou SHA; ler o README pelo `gh api repos/google/osv-scanner-action/readme` para o uso correto) lendo `pnpm-lock.yaml` e `services/rag/requirements.txt`, falhando em vulnerabilidade de dependência de produção; exceções só em `osv-scanner.toml` com motivo e prazo.
3. Dependências: `multer` 2.x (2.3.0 ou mais recente publicada), `axios` >= 1.20.0, `socket.io` que resolva `engine.io` >= 6.6.7 (confira com `pnpm why engine.io`). Depois do bump, `pnpm audit --prod --audit-level=high` tem de sair 0.
4. `errorHandler.ts`: `MulterError` com `code === 'LIMIT_FILE_SIZE'` vira 413 `"Arquivo maior que 20 MB. Divida o arquivo ou envie um menor."`; `LIMIT_UNEXPECTED_FILE` e demais códigos do multer viram 400 com mensagem em português; erro de tipo do `fileFilter` vira 415 `"Tipo de arquivo não suportado: envie PDF, TXT, MD ou CSV."` (crie uma classe `UnsupportedFileTypeError` com `statusCode = 415`). Em produção a mensagem 4xx continua indo para o cliente (o handler já preserva 4xx).
5. RAG: `pip install -r services/rag/requirements-dev.txt` e `pytest services/rag -q` verdes localmente; `ruff check` e `ruff format --check` verdes.
6. `dependabot.yml`: entradas `pip` e `docker` para `/services/rag`.

**Testes**
- `errorHandler.test.ts`: MulterError LIMIT_FILE_SIZE -> 413 com a mensagem; UnsupportedFileTypeError -> 415; erro genérico em produção -> 500 "Internal Server Error".
- `aiTraining.documents.route.test.ts` (existente): acrescentar caso de arquivo `.exe` -> 415 e caso acima do limite -> 413 (use o multer real com `fileSize` pequeno no teste, sem tocar o RAG).

**Prova**
- CI verde no PR (todos os jobs, inclusive `osv`).
- `pnpm audit --prod --audit-level=high` com saída 0 (colar no PR).
- `fly-deploy.yml` mostra os passos de teste em `build-check` (link do arquivo no PR).

### Tarefa A2: interruptores por organização e versões do prompt por gatilho
Branch `feat/flags-e-versoes`. Resolve A115 (parte), A083 (parte), P47, P14 (mínimo). Base para A7, A8 e a Onda B.

**Arquivos**
- Criar migração `packages/database/prisma/migrations/20260914000010_org_feature_flags_e_prompt_versions/migration.sql`
- Modificar `packages/database/prisma/schema.prisma` (models `OrgFeatureFlag` e `AgentPromptVersion`)
- Criar `apps/api/src/services/featureFlags.ts` + `featureFlags.test.ts`
- Criar `apps/api/src/services/promptVersionService.ts` + `promptVersionService.test.ts`
- Modificar os escritores de `agents.system_prompt`: `routes/agentQuality.ts` (apply e revert), `routes/adminAgentEval.ts` (apply e revert), `services/promptRemediationService.ts` (aplicar e reverter), `services/agentIdentitySync.ts`, `services/agentProvisioningService.ts` (create)
- Criar rotas admin: `apps/api/src/routes/adminFeatureFlags.ts` (GET `/api/admin/organizations/:id/flags`, PUT `/api/admin/organizations/:id/flags/:flag` com `{enabled, removeBy?}`), montar em `server.ts` com `requireRole('SUPERADMIN')`
- Criar rota de cliente: GET `/api/agent-quality/agents/:agentId/versions` (escopada, lista versões sem o texto completo) e GET `/api/agent-quality/agents/:agentId/versions/:version` (com o texto)

**Comportamento**
1. Tabela `org_feature_flags(organization_id text references organizations(id) on delete cascade, flag text, enabled boolean not null default false, value jsonb, remove_by date, updated_by text, updated_at timestamptz default now(), primary key (organization_id, flag))`, com RLS ligada, sem política, `REVOKE ALL ON org_feature_flags FROM anon, authenticated`.
2. `featureFlags.ts`: registro tipado `FLAGS` com `{ nome, descricao, removeBy: 'YYYY-MM-DD' }` para `perfilVivo`, `compositorUnico`, `guardaComercial`, `ragNoChatDoSite`, `evalNoTier`, `treinarSomenteAdmin`; `isFlagOn(orgId, flag)` lê do banco com cache de 30 s no `cache` do `services/cloud` (chave `zappiq:flag:<org>:<flag>`), padrão `false` em erro; `setFlag(orgId, flag, enabled, actor)` grava e invalida. Teste unitário que falha se alguma flag do registro tiver `removeBy` no passado (força limpeza).
3. Tabela `agent_prompt_versions(id uuid default gen_random_uuid() primary key, agent_id text references agents(id) on delete cascade, version int not null, system_prompt text not null, hash text not null, source text not null, decision_id text, created_by text, created_at timestamptz default now(), unique (agent_id, version))`, RLS ligada, `REVOKE` de anon e authenticated. Função e gatilho `AFTER INSERT OR UPDATE OF system_prompt ON agents` que insere a próxima versão com `source = coalesce(nullif(current_setting('zappiq.prompt_source', true), ''), 'fora_do_app')`, `decision_id = nullif(current_setting('zappiq.prompt_decision', true), '')`, `created_by = nullif(current_setting('zappiq.prompt_actor', true), '')` e `hash = md5(system_prompt)`; no UPDATE, só grava se `OLD.system_prompt IS DISTINCT FROM NEW.system_prompt`. Backfill na própria migração: versão 1 de cada agente existente com `source = 'migracao'`.
4. `promptVersionService.ts`: `publishPrompt({ agentId, systemPrompt, source, decisionId?, actor?, expectedHash? }, db?)`: numa transação, `SELECT set_config('zappiq.prompt_source', $1, true)` (e decision e actor), se `expectedHash` vier confere `md5(system_prompt)` atual (trava otimista; erro `PromptChangedError` se divergir), faz o `UPDATE agents SET system_prompt`, e devolve `{ version, hash }` lendo a linha criada pelo gatilho. Os 7 escritores e o create passam a usar `publishPrompt` (fontes: `fix_apply`, `fix_revert`, `identity_sync`, `remediacao`, `seed`). Teste com `db` injetado (padrão de `agentProvisioningService.test.ts`) provando que cada escritor chama `publishPrompt` com a fonte certa; teste de grep no CI: nenhum `agent.update(` com `systemPrompt` fora de `promptVersionService.ts` (arquivo `promptWriters.guard.test.ts` que lê os fontes).
5. `revert` do `agentQuality.ts` e do `adminAgentEval.ts`: só reverte se o hash atual for o `md5(promptAfter)` da decisão; caso contrário responde 409 `"O prompt mudou depois desta correção. Reverta pelo histórico de versões."`.

**Prova**
- Migração aplicada em produção pelo MCP do Supabase (antes, `BEGIN; ... ROLLBACK;` para provar que roda) e commitada.
- `UPDATE agents SET system_prompt = system_prompt || ' ' WHERE id = <agente STAGING>` seguido de `SELECT source FROM agent_prompt_versions ...` devolve `fora_do_app` (depois desfazer com nova versão).
- `has_table_privilege('anon','public.org_feature_flags','SELECT')` = false; idem `agent_prompt_versions`.

### Tarefa A3: Raio-X do que a IA recebe, sem chamar o modelo
Branch `feat/raio-x`. Resolve A072 (diagnóstico), base de prova para A7, A8 e Onda B. P72.

**Arquivos**
- Criar `apps/api/src/routes/adminAiXray.ts` + `adminAiXray.test.ts`; montar `POST /api/admin/ai-xray` com `requireRole('SUPERADMIN')`
- Criar `apps/api/src/agents/promptXray.ts` (puro: fatiar prompt por cabeçalhos e rodar checagens) + `promptXray.test.ts`
- Modificar `apps/api/src/services/webChatService.ts`: extrair `buildWebChatSystemPrompt({ orgPrompt, factsBlock, isIzaCanonical })` puro e exportado (mesmo texto de hoje, byte a byte)
- Modificar `apps/api/src/services/agentEvalRunner.ts`: extrair `buildEvalSystemPrompt(agent, scenario)` puro e exportado (mesmo texto de hoje)
- Criar página `apps/web/app/(dashboard)/admin/ai-xray/page.tsx` (seletor de organização, canal, 1 a 5 mensagens, resultado com as fatias e as checagens em verde e vermelho)

**Comportamento**
1. Corpo: `{ organizationId, canal: 'whatsapp' | 'instagram' | 'site' | 'playground' | 'qualidade', messages: [{ role: 'user'|'assistant', content }] }` (1 a 25 mensagens). Para cada turno de `user`: busca `ragService.searchWithSources(orgId, content, 5)` (só quando o canal usa RAG hoje: whatsapp, instagram, playground) e monta o prompt pelo mesmo caminho da produção: `buildSystemPromptForContact` com `contactId` sintético `xray:<orgId>` e `orgSettings` iguais aos que aquele canal passa hoje (Instagram passa `{}` até a A8 corrigir); site via `buildWebChatSystemPrompt`; qualidade via `buildEvalSystemPrompt`. Nunca chama LLM.
2. `promptXray.ts`: `sliceBySections(prompt)` devolve `[{ titulo, texto, chars }]` cortando nos cabeçalhos `#`/`##`/`###` de primeiro nível conhecidos (CORE, FATOS ATUAIS, prompt do agente, links, Cliente atual, Saudação, Contexto recuperado, Agora) e `runChecks({ prompt, settings, sources, ultimaMensagem })` devolve lista `{ id, rotulo, ok, detalhe }` com pelo menos: `tom_no_prompt` (o texto do tom de `settings.tone` aparece), `horario_confere` (o horário de `settings.businessHours` ou `businessHoursConfig` aparece e não há "Domingo: Fechado" quando o domingo está aberto), `saudacao_no_primeiro_contato`, `link_do_site`, `base_consultada` (há trechos), `qa_literal` (quando a última mensagem é igual a uma pergunta de Q&A ativo, a fonte `qa-<id>.txt` está nos trechos), `preco_na_base` (pergunta com "preço|quanto custa|valor" traz `pre_tabela_precos` ou Q&A de preço), `saudacao_contradiz_cr3` (saudação configurada contém "como posso ajudar" e variações).
3. Resposta: `{ turnos: [{ mensagem, prompt_chars, fatias, fontes, checagens }] }`. A tela mostra por turno; texto do prompt em `<pre>` recolhível.

**Testes**
- `promptXray.test.ts`: fatiamento com um prompt de exemplo; cada checagem com caso verde e vermelho (inclusive "Domingo: Fechado" com domingo aberto nas settings).
- `adminAiXray.test.ts`: 403 sem SUPERADMIN; 400 com mais de 25 mensagens; nunca chama `llmRouter` (mock que falha se chamado).

**Prova**
- Depois do deploy, o Raio-X da Vera (CMJ) e da Iza marca em vermelho `horario_confere` (antes da A8) e a captura vai no PR.

### Tarefa A4: retirar as promessas que o código não cumpre
Branch `feat/promessas-honestas`. Resolve A147, A205, A224, A185, A176, A179, A159, A183, A222, A223, A220, A218, A146, A246, A250, A207, A187, A003 (parte).

**Arquivos (web, salvo indicação)**
- `components/ai-training/FeatureGuide.tsx` (documents: "PDF, TXT, MD e CSV" no lugar de "PDF, TXT, DOCX, planilhas"; playground: trocar "fiel ao que o cliente veria no WhatsApp" por "usa a mesma montagem de instruções do WhatsApp; a memória da conversa é a desta tela"), `components/ai-training/NotIndexedAlert.tsx`, `app/(dashboard)/ai-training/page.tsx` (accept e texto "PDF, TXT, MD, CSV, até 20 MB cada"; sem doc, docx, xls, xlsx), `app/(dashboard)/treinar/qualidade/page.tsx:430` e `content/saiba-mais/qualidade.ts` (linhas 39, 90, 94: "boa parte da nota vem do quanto sabe", "re-testar pra conferir se pegou" e "passa a valer imediatamente" viram frases verdadeiras: a nota mede comportamento com cenários genéricos; o re-teste roda uma amostra e não fica gravado ainda)
- `components/onboarding/OnboardingWizard.tsx` e `SurveyIntroModal.tsx` ("tudo fica salvo automaticamente" só se o rascunho for salvo de fato; senão "não feche a aba antes de terminar"), `components/shared/ReadinessMilestoneNudge.tsx` ("Sua IA acaba de ficar pronta" vira "Seu treino chegou a X%")
- Landing e páginas públicas: `components/landing/Hero.tsx:407`, `ConectarWhatsApp.tsx:10`, `SocialProofToast` (dados no Brasil), `AgentQualityProactive.tsx` ("se corrige sozinha", "sem alucinação"), `SelfServiceTraining.tsx:42`, `Segments.tsx:44,47`, `app/lgpd/page.tsx:56`, `app/legal/enderecos-comerciais/page.tsx:47`, página de subprocessadores (residência de dados: dizer que o banco e o processamento ficam nos EUA, com as salvaguardas contratuais), `app/segmentos/saude/page.tsx:24,31,38` e `app/(dashboard)/crm/agenda/page.tsx:7` e `content/cases/vida-plena.ts` (agenda que confirma, lembra e remarca e depoimento de no-show), `app/recursos/RecursosPage.tsx:114` e `app/vendedor-digital/page.tsx:31` ("voz treinada nativamente")
- Rotas `app/como-funciona-survey`, `app/roadmap`, `app/observabilidade`: viram redirecionamento permanente para `/` com `noindex` (padrão de `/founders`), links removidos de menus, rodapé e sitemap
- API: `apps/api/src/routes/aiTraining.ts` (`ALLOWED_MIMES` sem doc, docx, xls, xlsx até a Onda B) e `apps/api/src/config/env.ts` (`APP_URL` padrão `https://zappiq.com.br`; conferir todo link de template de e-mail em `apps/api/src/services/` que use `www.` ou `app.`)
- Criar `apps/web/lib/promessas.test.ts`: lista de frases proibidas (`não saem do território nacional`, `se corrige sozinha`, `sem alucinação`, `DOCX`, `planilhas`, `boa parte da nota vem`, `fiel ao que o cliente veria`, `tudo fica salvo automaticamente`, `acaba de ficar pronta`, `voz treinada nativamente`, `confirma, lembra`, `no-show`) varrendo `app`, `components`, `content` e `lib` (excluindo o próprio teste e `blog/`, que é editorial e vai ser revisado à parte); falha com arquivo e linha.
- Travessões: trocar `—` por vírgula, ponto ou dois-pontos nos textos de tela tocados.

**Prova**
- Preview da Vercel do PR: `curl -s <preview>/<rota> | grep -c "<frase>"` = 0 para cada frase e rota pública; `/roadmap` responde 308 para `/`.
- Teste `promessas.test.ts` verde no CI.
- Todo link dos templates de e-mail responde 200 no domínio do app (script no PR).

### Tarefa A5: blindar as telas e o processo que atende (parte 1)
Branch `feat/blindagem-telas`. Resolve A156, A115, A204 (parte), A016, A201, A190.

**Arquivos**
- `apps/api/src/routes/settings.ts` e `routes/settings.schema.ts`: `settings` passa a ser mesclado por chave (merge raso do objeto de primeiro nível e merge raso dentro de `surveyAnswers`), com lista de chaves que só o servidor grava e que são removidas do corpo (`addons`, `miraAlpha`, `llm_routing`, `flags`, `consolidarBaloes`, `whatsapp*`, `instagram*`, `meta*`, `stripe*`, `trial*`) e resposta 400 quando o corpo tenta gravar uma delas
- `apps/api/src/server.ts`: `/api/agent-quality` montado com `authMiddleware, rlsTenantMiddleware, requireActivePlan`; `routes/agentQuality.ts`: `run-async`, `apply-fix`, `reject-fix`, `re-test`, `generate-suggestion`, `revert` exigem `requireRole('ADMIN','SUPERADMIN')`; `re-test` e `generate-suggestion` com cota de 20 por organização por dia (contador no Redis, chave `zappiq:quota:<org>:<rota>:<yyyy-mm-dd>`), 429 com mensagem em português
- `apps/api/src/services/ragService.ts`: `ingestUrl` resolve o DNS com `dns.promises.lookup(hostname, { all: true })`, recusa qualquer endereço em `net.BlockList` (loopback, link-local, 10/8, 172.16/12, 192.168/16, 100.64/10, IPv6 ::1, fc00::/7, fe80::/10, ::ffff:mapeados), usa o endereço resolvido na requisição com `lookup` fixo, `maxRedirects: 0` e segue no máximo 3 redirecionamentos revalidando cada destino; limite de 20 MB e tempo de 30 s mantidos; teste com `dns` simulado
- Chaves fora da URL e dos spans (A201): onde a chave do Gemini vai na query string, mover para o cabeçalho `x-goog-api-key`; nos spans de OpenTelemetry, remover a query string das URLs registradas
- `apps/api/src/services/webChatService.ts` (A190): o histórico enviado pelo widget deixa de ser a fonte: o servidor monta o histórico a partir das mensagens gravadas da conversa da sessão (`conversations.channel = 'web'`, últimos 20 turnos) e ignora `history` do corpo; antes de chamar o modelo, se `conversation.aiPaused` for verdadeiro, responde `{ paused: true }` sem chamar o LLM e sem gravar resposta de bot

**Testes**
- `settings.route.test.ts`: PUT sem `addons` não altera `settings.addons`; PUT com `addons` responde 400; merge por chave preserva `surveyAnswers.identidade_empresa` ao gravar outra seção.
- `agentQuality.roles.test.ts`: AGENT recebe 403 em `apply-fix`; 21ª chamada de `re-test` no dia recebe 429.
- `ragService.ssrf.test.ts`: hostname que resolve para `169.254.169.254` é recusado; redirecionamento para `http://10.0.0.1` é recusado.
- `webChatService.history.test.ts`: turno `assistant` forjado no corpo não chega ao modelo; `aiPaused` impede a chamada.

**Prova**: testes no CI; no preview, `PUT /api/settings` com `{"settings":{"addons":["X"]}}` responde 400 (curl com token de teste de um agente STAGING, se disponível; senão a prova é o teste de rota).

### Tarefa A6: privilégios do banco em migração versionada
Branch `feat/db-privilegios`. Resolve A196, A230, A112 (registro).

**Arquivos**: criar `packages/database/prisma/migrations/20260914000020_revoke_anon_public/migration.sql`.

**Comportamento**: `REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated; REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated; REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated; ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;` (idem sequences e functions); toda view do schema public ganha `ALTER VIEW ... SET (security_invoker = true)`; bloco `DO` idempotente e tolerante a objeto inexistente. Exceção: manter `EXECUTE` nas funções usadas por `auth` do Supabase se houver (conferir com `SELECT proname FROM pg_proc WHERE pronamespace='public'::regnamespace`); o front usa `service_role` nas rotas de servidor e `anon` só no schema `auth`.

**Prova**: rodar em produção dentro de `BEGIN; ... ROLLBACK;`, depois aplicar pelo MCP; `SELECT count(*) FROM information_schema.role_table_grants WHERE grantee IN ('anon','authenticated') AND table_schema='public'` = 0; login e cadastro do web continuam funcionando (teste manual no site e `/api/auth` no preview).

### Tarefa A7: cron e custo da Qualidade com dono
Branch `feat/cron-com-dono`. Resolve A045, A067, A048, A209, A225, A192, A047, A200, A053.

**Arquivos**: `services/agentEvalCronService.ts`, `services/cronQueue.ts`, `services/agentEvalRunner.ts`, `services/llm/LLMRouter.ts` (tipo `LLMOperation` ganha `'eval'`), `services/llm/llmCallAudit.ts` (custo do Gemini corrigido pela tabela oficial; chamadas `eval` não entram no teto do trial nem no disjuntor da organização, mas entram no custo por organização), `services/llm/circuitBreaker.ts`, `routes/agentQuality.ts` e `routes/adminAgentEval.ts` (execução vira job BullMQ), novo `services/agentEvalQueue.ts`.

**Comportamento**
1. Elegibilidade única `isEvalEligible(org)`: exclui organizações cujo nome ou slug contenha `STAGING`, organizações com trial vencido sem assinatura (reusar o helper de estágio de conta já existente), e organizações sem nenhum trecho no RAG e sem Q&A (`sem base cadastrada`, registrado no log e não executado).
2. `agent-eval-iza` passa a semanal (domingo 04:30 UTC); `agent-eval-clients` semanal (segunda 04:30 UTC) só elegíveis; job novo diário `agent-eval-on-change` que executa 1 vez por organização quando houve evento `kb.*` em `audit_logs` ou nova versão de prompt desde a última execução concluída (teto: 1 por organização por dia).
3. Toda chamada de LLM do avaliador leva `orgId` da organização do agente e `operation: 'eval'`. `llmCallAudit`: `eval` grava custo com `organization_id`, não soma no `zappiq:trial_cost_usd` nem no breaker mensal da organização.
4. Execução como job na fila `agent-eval` (concorrência 1, tempo limite 25 min, `removeOnComplete`); `run-async` enfileira e responde 202; varredura horária marca `failed` com erro `"tempo limite"` toda execução `running` há mais de 1 hora.
5. Tempo limite por chamada de LLM no avaliador (`AbortSignal.timeout(60_000)`).
6. Alerta Slack: só quando o mesmo cenário reprova em 2 execuções consecutivas do mesmo agente ou há crítico reprovado; nunca por nota abaixo de 90. `slackAlertStatus` gravado em toda execução do cron.
7. Preço do Gemini 2.5 Flash em `llmCallAudit` conforme a tabela oficial do Google (citar a URL no comentário).

**Testes**: `agentEvalCronService.eligibility.test.ts` (STAGING fora, trial vencido fora, sem base fora), `llmCallAudit.eval.test.ts` (eval não soma no trial), `agentEvalQueue.test.ts` (varredura marca failed), regra de alerta com 2 falhas consecutivas.

**Prova**: depois de uma semana, `SELECT round(sum(cost_usd_estimate),2) FROM llm_call_logs WHERE organization_id IS NULL AND created_at > now()-interval '7 days'` = 0; `agent_eval_runs` sem `running` há mais de 1 hora; próximo cron sem organização STAGING.

### Tarefa A8: identidade, horário e agendamento honestos em todos os canais
Branch `feat/perfil-vivo`. Resolve A058, A059, A060, A057, A070, A170, A153, A162, A164, A194, A154, A184, A155, A165, A066, A228, A212, A233. Depende da A2 (flag `perfilVivo`) e da A3 (prova).

**Arquivos**
- Criar `apps/api/src/agents/tenantLiveProfile.ts` + `tenantLiveProfile.test.ts`
- Modificar `agents/agentOrchestrator.ts` (`buildSystemPromptForContact`: bloco vivo logo depois de `agent.systemPrompt`, antes de `linksBlock`, quando `isFlagOn(orgId,'perfilVivo')`), `services/webChatService.ts` (mesmo bloco, mesma flag; saudação no primeiro turno da sessão), `routes/webhookInstagram.ts:383` (`orgSettings: (org.settings as any) || {}`), `routes/settings.ts` (Configurações grava nome, tom, horário e segmento pela mesma fonte: `agentName`, `tone`, `businessHoursConfig`; chama `syncAgentIdentity` quando o nome muda), `agents/promptEngine.ts` (seed sem `SCHEDULING_INSTRUCTIONS`, sem "Data/hora atual", sem seção de tom e de horário; `buildHoursSection` reescrita para o formato único e "não informado"), `agents/nichePrompts.ts` (retirar afirmações de oferta: aula grátis, convênios, pacotes, delivery, status de pedido, urgência de vagas; manter papel e perguntas de qualificação; normalizar chaves sem acento com mapa de compatibilidade), `services/llm/tools.ts` (remover `get_org_billing_summary` da lista oferecida), `services/llm/izaTurnRouter.ts` e `agentOrchestrator.ts` (`schedulingOn` = há tipo de agendamento ativo E a organização tem direito ao recurso; Sonnet forçado só nesse caso), `agents/coreAgentRules.ts` ou o bloco cliente (frase "já tem histórico" só quando há histórico no contexto), `promptEngine.ts` (bloco `<buttons>` fora do BASE_INSTRUCTIONS)
- Criar script `apps/api/scripts/limparPromptsCongelados.ts` (padrão do `promptRemediationService`: `--dry-run` imprime o diff por agente; aplica via `publishPrompt` com `source: 'migracao'`): remove das instruções gravadas dos 15 agentes a seção `## HORÁRIO DE FUNCIONAMENTO`, a linha `Data/hora atual: ...` e o bloco `### Fluxo de Agendamento`; recusa gravar se o resultado ficar com menos de 60% do tamanho ou perder a linha `## IDENTIDADE`

**Comportamento do bloco vivo** (`buildLiveProfileBlock(settings, profile, opts)`):
```
# Como você atende nesta empresa
- Você é <agentName>, de <businessName>.
- Tom de voz: <texto de getToneInstructions(settings.tone) resumido numa linha>
- Horário de atendimento humano: <texto único a partir de businessHoursConfig, businessHours em inglês ou português> ou "não informado (não afirme dias ou horários de funcionamento; diga que vai confirmar)"
- Agora: <aberto|fechado> (só quando há businessHoursConfig, via isOpen)
- Ao transferir para uma pessoa, diga: "<handoffMessage>" (só se houver)
- Agendamento: <"disponível para: tipos ativos" | "não ofereça agendamento por aqui">
```
Teto de 1.500 caracteres; campos vazios omitidos; normalizador cobre os três formatos de horário (`{weekdays,saturday,sunday,holidays}`, `{Segunda..Domingo}` e `businessHoursConfig`). Sem a flag, nada muda no prompt (byte a byte, provado por teste de snapshot).

**Testes**: unitários do normalizador (3 formatos, ausência), do teto, do bloco por flag; `webhookInstagram.test.ts` prova que `orgSettings` vai preenchido; `agentOrchestrator.liveProfile.test.ts` prova posição do bloco e ausência com flag desligada; `tools.test.ts` sem `get_org_billing_summary`; `izaTurnRouter.test.ts`: sem tipo ativo não força Sonnet.

**Prova**: script em `--dry-run` colado no PR; após deploy e flag ligada para MACHIA, o Raio-X mostra o bloco vivo e `horario_confere` verde no WhatsApp e no site; `SELECT count(*) FROM agents WHERE system_prompt ILIKE '%Domingo: Fechado%'` = 0 depois do script; depois de ligar para Iza e CMJ, mesmo Raio-X.

### Tarefa A9: Vera e Iza antes do treinamento do CMJ (18/09)
Branch `feat/vera-iza-antes-do-treinamento`. Resolve A229, A086, A059, A060, A048. Depende da A2.

**Arquivos**: `services/izaFactsService.ts` (seção de preços gerada de `packages/shared/src/planConfig.ts`: planos ativos não descontinuados, preço mensal, cota de mensagens, desconto anual, add-ons públicos; nada do Stripe), `izaFactsService.test.ts` (todo valor em reais renderizado existe no planConfig), `scripts/check-iza-drift.sh` (falha se houver `- [ ]` aberto há mais de 7 dias em `docs/iza-facts-changelog.md`), `apps/api/scripts/removerTabelaDePrecosDaIza.ts` (dry-run e aplicação por `publishPrompt` com `source: 'migracao'`: remove do prompt da Iza a lista `**Planos** (mensal): ...` e os valores em reais da `REGRA 7 OVERAGE`, mantendo as regras de como falar de preço), entrada em `docs/iza-facts-changelog.md`.

**Prova**: `SELECT count(*) FROM agents WHERE organization_id='cmo1ywwfe00ko1jskexiexsm4' AND system_prompt LIKE '%997%'` = 0; Raio-X da Iza com "quanto custa?" mostra os valores do planConfig no bloco de fatos; execução seguinte da Qualidade da Iza sem regressão nos cenários de preço.

---

## Onda B (depois da Onda A fundida)

### Tarefa B1: nota honesta (regravar, depois corrigir a régua). Passo 6 do laudo: P61 e P56. Tabela `eval_regrades`, script de regravação sobre `agent_eval_runs.results` (v2), gabarito v3 (juiz com 500 tokens e leitura tolerante, falha técnica fora da nota, cr5 alinhado ao CR-6, expectativa dupla de desconto da Iza corrigida, fronteira Unicode, prazo inventado reprovado, extração de `<reply>` como na produção, crítico parcial contado, GET /runs/:id sem invalidadas, cooldown em Brasília, aplicação recusa regra cortada), aviso na tela com a nota recalculada.
### Tarefa B2: documentos (passo 9). Source estável `doc-<id>`, 409 para título repetido, migração dos `rag_chunks`, cabeçalho de título por trecho (P64), conversores mammoth e openpyxl, pypdf no lugar do PyMuPDF, erros 413/415/422 em português, Readability para URL com portão de conteúdo mínimo e recusa de rede social, apagar URL apaga trechos, estado `processando` no kb_document. Volta a aceitar Word e Excel na tela.
### Tarefa B3: questionário (passo 10). Tabela de destino por pergunta em `packages/shared`, `knowledgeBaseBuilder` recursivo com o texto da pergunta e um bloco por seção, regras do questionário no bloco vivo, reingestão com debounce do BullMQ, estado "a IA ainda não recebeu".
### Tarefa B4: busca (passo 11). Chave de cache sha256 com versão de configuração, prioridade e categoria do Q&A no ranking, Q&A num trecho só, no máximo 2 trechos por fonte, corte recalibrado, consulta de continuação reescrita, status "sem resultado" separado de "serviço fora", eval recall@5 no pytest.

## Onda C
### Tarefa C1: um só motor em todos os canais (passo 12). `composeAgentContext` puro com snapshot, consumidores WhatsApp, Instagram, site, Testar minha IA com memória real, Maestro e Qualidade; pós-processador único de saída; chat do site com transbordo; base no site por flag.
### Tarefa C2: Qualidade que testa o agente real (passo 13). Cenários gerados dos Q&A e da tabela de preços, juiz que vê pergunta, histórico e trechos, natureza por cenário, placar Conhecimento x Comportamento.
### Tarefa C3: correção que pega e fica (passo 14). Regras como registros, substituição por cenário, revert cirúrgico, sugeridor com CORE resumido, verificador de conflito, re-teste gravado com 3 amostras.
### Tarefa C4: porta de entrada (passo 8). CHECK de `signups` derivada de `PLAN_IDS`, plano gravado antes do redirecionamento do Google, eventos de funil, rede de crise no pré-filtro com corpo de negativos por segmento.

## Trabalho que só o fundador faz (vira arquivo .command na Mesa)
1. Restaurar a chave do Gemini (depois de fixar Sonnet no `llm_routing` da Iza e do CMJ, feito por SQL nesta sessão).
2. Ligar os alertas do Dependabot (`gh api -X PUT repos/rmghetti/zappiq/vulnerability-alerts`).
3. Promover o usuário AUDITOR do CMJ a ADMIN (antes de fundir a tarefa A5 parte 2, `treinarSomenteAdmin`).
4. Com o CMJ antes de 18/09: reenvio dos 3 PDFs, preço que vale, revisão dos 5 documentos internos.
5. Decidir homologação (custo novo) e contatar ou não os 4 leads sem organização.
