# Riscos latentes no fluxo real do WhatsApp (Iza) — segunda frente

Levantados durante a investigação do bug do playground "Testar minha IA" (a IA repergunta o
nome já respondido). Esse bug era exclusivo do playground e foi corrigido separadamente. Os itens
abaixo são riscos **do caminho de produção (WhatsApp)** que NÃO foram tocados nessa correção.
Documento de priorização, não de execução. Nada aqui foi alterado.

Data do levantamento: 2026-07-17.

---

## 1. `Contact.name` é sobrescrito a cada mensagem inbound pelo nome do perfil do WhatsApp

**Severidade: alta.** É o risco com maior chance de reproduzir, em produção, o mesmo sintoma que o
cliente relatou no playground (a IA reperguntar/errar o nome), só que no canal real.

- **Onde:** `apps/api/src/routes/webhook.ts:119` e `:141-142`.
- **O que acontece:** a cada mensagem que entra, o contato é feito `upsert` com
  `update: { name: contactName }`, onde `contactName = value.contacts?.[0]?.profile?.name || from`
  (o nome do perfil do WhatsApp, ou o número puro se o perfil não expõe nome).
- **Por que é problema:** se a Iza capturou um nome preferido via `<action>set_contact_name</action>`
  (`agentOrchestrator.ts:952-964`), o próximo turno inbound **reverte** esse nome para o do perfil
  do WhatsApp. Pior caso: contatos sem nome de perfil ficam com o número como "nome", e o
  `clienteBlock` do system prompt (`agentOrchestrator.ts:1106-1115`) passa a injetar um número onde
  deveria ir o nome, levando a IA a reperguntar.
- **Direção de correção (a decidir):** não sobrescrever `name` no upsert de mensagem se já existe um
  nome definido pela IA; ou usar um campo separado para o nome de perfil do WhatsApp, mantendo
  `Contact.name` como o nome canônico curado. Precisa de decisão de produto sobre qual nome vence.

---

## 2. `Conversation.currentFlowState` é uma coluna órfã — estado do fluxo mora só no Redis

**Severidade: média.** Não gera o sintoma do nome, mas causa perda silenciosa de estado de fluxo
(Maestro) em produção.

- **Onde:** `packages/database/prisma/schema.prisma:475` declara `currentFlowState Json?` no
  `model Conversation`, mas nenhuma leitura/escrita existe em `apps/api/src` (grep zerado).
- **O que acontece:** o estado real do fluxo (`{ cursor, vars, flowId, callStack }`) é gravado no
  cache com chave `flow_state:${orgId}:${conversationId}` e **TTL de 7 dias**
  (`apps/api/src/agents/flowRuntime.ts:55-57,277`).
- **Por que é problema:** expiração do TTL, flush ou troca de instância Redis = perda do cursor e
  dos `vars` do fluxo no meio de uma conversa. A conversa "reinicia" o fluxo sem aviso. A coluna
  Postgres que existiria justamente para dar durabilidade nunca é usada.
- **Direção de correção (a decidir):** ou persistir o estado do fluxo em `currentFlowState` (Postgres
  como fonte durável, cache como aceleração), ou remover a coluna órfã e assumir explicitamente que
  fluxo é efêmero por design. Hoje o schema promete durabilidade que o runtime não entrega.

---

## 3. Fora do Maestro não há extração determinística de campos coletados

**Severidade: média a alta**, dependendo de quanto a operação depende de campos além do nome.

- **Onde:** caminho "Iza pura" (org sem `settings.maestro.enabled` + Flow ativo), que é o padrão
  da maioria das conversas.
- **O que acontece:** o único campo persistido de forma estruturada é o **nome**, e só se o LLM
  espontaneamente emitir `<action>set_contact_name</action>` (`agentOrchestrator.ts:833-870,952-964`).
  Todos os outros campos (email, empresa, etc.) só "existem" enquanto estiverem dentro das últimas
  20 mensagens reinjetadas no prompt (`agentOrchestrator.ts:325-330`). Passou de 20 turnos, o campo
  sai do contexto e a IA volta a perguntar.
- **Agravantes de fragilidade da via `set_contact_name`:**
  - A instrução que ensina o LLM a emitir essa tag NÃO está no código — vive na `Agent.systemPrompt`
    do banco (seed V7, "REGRA 9"). Se o Agent daquela org não tiver a regra, o nome nunca é salvo.
  - O fallback `apps/api/src/agents/promptEngine.ts:64` (orgs sem Agent seedado) ensina o contrato
    de saída `<action>schedule|handoff|save_lead|pay_link</action>` e **não lista** `set_contact_name`.
    Nessas orgs, nome nunca é persistido por essa via.
  - `Contact.customFields` (`schema.prisma:420`) existe e é gravável pelo Maestro (`flowEffects.ts:88-112`),
    mas **nunca é reinjetado no system prompt** — o `clienteBlock` só lê `name`, `leadStatus` e um
    contador de mensagens (`agentOrchestrator.ts:1080-1098`). Campo salvo em `customFields` é invisível
    para a IA no turno seguinte.
- **Direção de correção (a decidir):** extração determinística leve (structured output / tool call)
  para campos-chave fora do Maestro, e/ou reinjetar `customFields` relevantes no `clienteBlock`.
  Decisão de escopo: quais campos merecem ser "memória durável" versus dependência do histórico.

---

## Observação transversal

Há **dois armazenamentos desconexos** de "campos coletados" que não conversam entre si:

- `vars` do fluxo (Maestro): efêmero (Redis, TTL 7d), interpolado só em textos de nós, **não** entra
  no system prompt do LLM.
- `Contact.name` / `customFields`: durável, mas só `name`/`leadStatus` reentram no prompt.

Qualquer correção dos itens 1 e 3 deveria decidir, de forma única, **qual é a fonte de verdade dos
campos coletados e como ela reentra no contexto do LLM a cada turno** — hoje isso está fragmentado.
