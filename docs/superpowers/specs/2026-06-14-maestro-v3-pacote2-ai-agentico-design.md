# Maestro v3 — Pacote 2.6: AI Step Agêntico (Tools / Webhook) — Design

> **Data:** 2026-06-14 · **Status:** aprovado (autonomia delegada)
> **Pacote:** 2 (Cérebro) — item 6. O maior diferencial restante.
> **Depende de:** `LLMRouter` (tools single-shot), motor (`ai` node), `assertPublicUrl` (SSRF, ragService).

## 1. Objetivo
O nó-IA do fluxo pode usar **ferramentas (function-calling)** — começando pela **webhook tool** (chamar um endpoint HTTP do cliente: consultar pedido, agendar, integrar com qualquer backend). O agente roda um **loop agêntico**: LLM decide chamar a ferramenta → executamos → devolvemos o resultado → LLM responde. *Nenhum player verificado tem webhook nativo no fluxo.*

## 2. Invariante de segurança/regressão
- **Sem regressão:** o caminho agêntico só roda quando o nó-IA tem `data.tools` configuradas. Nós-IA sem tools seguem EXATAMENTE o caminho atual (`routeIzaTurn`). Zero impacto nos fluxos existentes.
- **SSRF:** toda URL de webhook passa pelo `assertPublicUrl` (bloqueia localhost/IP privado/metadata). Reuso do guard já em produção.
- **Sem segredos em texto no v1:** a config do webhook (url/método/headers) fica no `node.data` (visível ao admin da org). Documentar: use um **token de webhook dedicado** (na URL ou header), não um segredo mestre. Secret-store criptografado = follow-up.
- **Limites:** timeout (8s), tamanho de resposta (32KB), máx 3 iterações de tool no loop (anti-loop + custo), métodos GET/POST.

## 3. Componentes

### AG1 — `LLMMessage` com content blocks (LLMRouter)
Hoje `LLMMessage.content: string`. Estender para `string | LLMContentBlock[]` onde `LLMContentBlock` ∈ `{ type:'text', text }` | `{ type:'tool_use', id, name, input }` (assistant) | `{ type:'tool_result', tool_use_id, content }` (user). No `AnthropicProvider.invoke`, mapear: mensagens com `content` array viram blocks nativos da Anthropic; string continua igual (retrocompat). Aditivo — testável (mapeamento puro).

### AG2 — `webhookTool.ts` (IO, SSRF-guarded)
- `buildWebhookToolDef(cfg)` (puro): converte a config do nó (`{ name, description, url, method, headers?, paramsSchema? }`) num `ToolDefinition` para o LLM (input_schema = paramsSchema ou um objeto livre).
- `executeWebhook(cfg, input)` (IO): `assertPublicUrl(cfg.url)` → fetch com timeout 8s, `AbortController`; GET (params na query) ou POST (input no body JSON); headers estáticos; lê ≤32KB; retorna `{ ok, status, body }` (string truncada). Fail-soft: erro/timeout → `{ ok:false, error }` (string que volta pro LLM como tool_result — o agente sabe lidar). TDD: mock fetch (sucesso/erro/timeout) + casos SSRF (assertPublicUrl rejeita).

### AG3 — `flowAiAgent.ts` (loop agêntico, deps injetadas → testável)
`runAgenticTurn({ system, userMessage, history, tools, deps })`:
- `deps.callLLM(messages, tools)` → `{ text, toolCalls, stopReason }`. `deps.runTool(name, input)` → string (resultado).
- Loop (máx 3 iters): chama LLM com tools; se `stopReason==='tool_use'` → para cada toolCall, `runTool` → monta `tool_result` blocks → adiciona ao histórico → repete; senão → retorna `text` final. Anti-loop pelo cap. Fail-soft: tool que erra → tool_result com a mensagem de erro (o LLM segue). Pura quanto à lógica (LLM/tools via deps). TDD com stubs (sem tool → texto direto; 1 tool → executa e responde; tool erro → segue).

### AG4 — motor + integração no orquestrador
- Motor (`flowEngine` case 'ai'): `FlowStepResult.aiTools?: any[]` ← `node.data?.tools` (aditivo, 1 linha, puro).
- Orquestrador (`agentOrchestrator`): no ponto do nó-IA (após `resolveActiveFlowStep`), se `flowStep.aiTools?.length` → monta os `ToolDefinition` (webhook), chama `runAgenticTurn` (deps reais: `callLLM`=llmRouter.complete com tools, `runTool`=executeWebhook) com o MESMO system prompt (CORE+RAG+aiPrompt) e envia a resposta. Senão → caminho atual `routeIzaTurn` inalterado. **Fail-soft:** qualquer erro no caminho agêntico → cai no caminho normal (degrada, nunca quebra o turno).

### AG5 — editor: configurar tool no nó-IA
No inspetor do nó `ai`, uma seção "Ferramentas (avançado)" → adicionar uma **webhook tool**: nome, descrição (o que faz / quando usar — vai pro LLM), URL, método (GET/POST), headers (pares chave-valor), e um aviso de segurança ("não coloque segredos mestres aqui"). Grava em `node.data.tools = [{ type:'webhook', ... }]`. Validação na publicação: URL http(s).

### AG6 — smoke/doc.

## 4. Testes
- AG1: mapeamento de content blocks (string vs array) no provider — puro.
- AG2: `buildWebhookToolDef` (puro) + `executeWebhook` (mock fetch: ok/erro/timeout; SSRF rejeita).
- AG3: `runAgenticTurn` com deps stubadas (sem tool / 1 tool / tool erro / cap de iterações).
- AG4: motor expõe `aiTools`; integração coberta por smoke (orquestrador é IO-heavy).
- Editor: typecheck + smoke.

## 5. Escopo / YAGNI
- **Dentro v1:** webhook tool, loop agêntico, integração gated, editor.
- **Fora:** tools built-in (consultar CRM/pedido) — webhook cobre via endpoint do cliente; secret-store criptografado; saída estruturada que escolhe o ramo (o agente responde texto; ramificação por var/keyword já existe); streaming do loop agêntico; KB escopada por nó.

## 6. Referências
- `LLMRouter.ts` (tools, ToolDefinition, ToolCall, AnthropicProvider.invoke), `LLMMessage`.
- `agentOrchestrator.ts` (nó-IA: após resolveActiveFlowStep → routeIzaTurn), `flowEngine.ts` (case 'ai', FlowStepResult).
- `ragService.assertPublicUrl` (SSRF). `tools.ts` (registry existente).
