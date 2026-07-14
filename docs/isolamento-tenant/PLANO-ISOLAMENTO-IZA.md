# Isolamento de tenant: a Iza não pode vazar para o cliente

**Data:** 14/07/2026
**Origem:** relato do CMJ. A funcionalidade "Qualidade da IA" estava testando e corrigindo a Vera (agente do CMJ) como se ela fosse a Iza.
**Status:** EXECUTADO em 14/07/2026. Ondas 1 a 7 aprovadas pelo fundador e implementadas.

## Resultado verificado

| Verificação | Evidência |
|---|---|
| Gabarito da Vera | 16 cenários, zero vazamento da ZappIQ, pergunta "me explica como funciona a **CMJ**" |
| Cenário que a reprovava | ANTES: `Identificar como "Iza da ZappIQ"` → REPROVADA. DEPOIS: `Identificar-se como "Vera", de CMJ` → APROVADA |
| **Teste real com IA (14/07)** | **Vera: 88% (14/16), 0 críticas.** Perguntaram "vocês são da ZappIQ? é a Iza?" e ela respondeu "Não, sou a Vera, da CMJ". Os 2 pontos restantes (pediu CPF; usou "como posso ajudar") são melhorias reais de atendimento do CMJ, não mais artefatos da ZappIQ. Antes: 52%, 3 críticas. |
| Prompt de produção | 14/14 agentes de clientes deixaram de mandar lead para `zappiq.com.br` |
| Iza | 30 cenários, marca própria preservada, prompt de 26.886 chars intacto, 81 runs preservadas |
| Scores falsos | 26 runs de clientes marcadas `invalidated` (auditoria preservada) |
| Testes | 1214 passando, tsc exit 0. Os 7 vermelhos do `queueService` são pré-existentes (commit 4a8b77d, mock desatualizado) |
| Trava anti-regressão | Provada: injetei o cenário contaminado e o CI quebrou; removi e voltou verde |

Reversão, se necessário:
- prompts: `update agents a set system_prompt = b.system_prompt_before from agents_prompt_backup_20260714 b where b.agent_id = a.id;`
- scores: `update agent_eval_runs set status='completed' where status='invalidated';`

## Princípio único (definido pelo fundador em 14/07/2026)

> "A Iza deve ser enxergada como um agente apenas da ZappIQ, como se a ZappIQ fosse um cliente isolado da Plataforma. Todos agentes de clientes diferentes devem ser tratados de forma isolados."

A ZappIQ **não é** a plataforma: é um tenant como qualquer outro, que por acaso hospeda a Iza. O isolamento tem dois eixos, e os dois valem sempre:

1. **ZappIQ contra cliente.** Nada específico da ZappIQ entra no caminho de um cliente sem gate explícito de organização. Foi o eixo violado no incidente do CMJ.
2. **Cliente contra cliente.** Nada de um tenant alcança outro: escopo por `organizationId` em toda query de rota de cliente, RAG por namespace `org_<id>`, e nenhum cache em memória sem chave por org.

Agravante que torna isso crítico: a Row Level Security do Postgres está desligada em ~31 tabelas, então o isolamento depende 100% do código da API.

## Causa raiz

A plataforma nasceu vendendo a si mesma (dogfood da Iza). As ferramentas foram construídas *para a Iza* e depois abertas aos clientes sem trocar a fonte da verdade.

O código **já sabe** separar a org da Iza da org do cliente. A constante `IZA_ORG_ID` existe e aparece em 6 arquivos. Mas o gate só foi aplicado em **um** lugar:

```ts
// apps/api/src/agents/agentOrchestrator.ts:1127
// W1.4 (vazamento de marca): os facts são fatos da ZappIQ. Só a org canônica
// da Iza pode recebê-los, senão o bot do CLIENTE passa a falar da ZappIQ.
const factsBlock = organizationId === IZA_ORG_ID ? await getIzaFactsBlock() : '';
```

Todos os outros caminhos ficaram sem esse gate. A correção é estender o padrão que já existe, não inventar arquitetura nova.

## Vazamentos confirmados, por quem enxerga

### Nível 1: chega ao cliente final do CMJ (o lead)

| # | Arquivo | O que vaza | Status |
|---|---|---|---|
| 1 | `services/llm/blockedVerticalFilter.ts:135-144` | "a **ZappIQ** não atende o segmento de apostas". Roda em todo turno de toda org, antes do LLM (`izaTurnRouter.ts:135`), disparado por regex largo (`cassino`, `hinode`, `polishop`, `multinível`) | Ativo assim que o WhatsApp do CMJ ligar |
| 2 | `agents/promptEngine.ts:40-47` | Bloco "URLs canônicas ZappIQ" manda o lead para `zappiq.com.br/cadastro` | **Comprovado**: o juiz flagrou a Vera fazendo isso em 13/07 |
| 3 | `agents/schedulingTools.ts:149` | "Agendado pela IA (ZappIQ)" no convite do Google Calendar, com o lead como convidado | Latente (agendamento desligado) |

### Nível 2: avalia e corrige o agente do cliente (o relatado)

| # | Arquivo | O que vaza |
|---|---|---|
| 4 | `agents/agentEvalSet.ts` | 18 dos 25 cenários são da ZappIQ (preço R$197, `cal.com/rodrigoghetti`, "Iza da ZappIQ", verticais, stack) |
| 5 | `services/agentEvalCronService.ts:229` | Roda sozinho, semanal, em todo cliente (`organizationId: { not: IZA_ORG_ID }`) |
| 6 | `routes/agentQuality.ts:508-511` | O botão "Aplicar" grava o patch derivado do gabarito da Iza no `Agent.systemPrompt` do cliente |
| 7 | `services/llm/intentClassifier.ts:101` | Rotula toda fala da Vera como `Iza:` e classifica com SKUs da ZappIQ (Voice 200, Growth, Take Blip) |
| 8 | `services/impulsoStrategist.ts:46` | "Você é a Iza, gerente de campanhas da ZappIQ" escreve a campanha do cliente |
| 9 | `agents/coreAgentRules.ts:48,96,99,183` | "# CORE RULES ZAPPIQ", "14 dias grátis", "Starter, Growth, Scale", "lida em voz alta pela Iza" |

### Nível 3: o cliente lê "Iza" no próprio painel

Campanhas ("Iza Estrategista"), Analytics ("Fechada pela Iza"), Conversas ("Retomar Iza"), Maestro ("Iza responde (IA)"), templates de fluxo ("Sou a Iza da Clínica X", só no preview: o runtime lê `data.text`, não `data.message`).

A regra certa já está escrita e implementada em `components/dashboard/AgentTrainingWidget.tsx:18`: *"nada hardcodado 'Iza'. Nome do agente vem de organization.settings.agentName"*. Basta replicar.

### Nível 4: bombas armadas

| # | Arquivo | Risco |
|---|---|---|
| 10 | `services/llm/tools.ts:159` | Gate `internalOnly` morto: nenhuma tool o declara, nenhum caller passa `isIzaOrg`. `get_org_billing_summary` (plano, cota, overage, teto em R$) seria entregue ao agente de qualquer cliente. Só não dispara porque agendamento está desligado em todas as orgs. **A Fase 2 do Agendamento arma isso.** |
| 11 | `routes/aiTraining.ts:717-731` | Drift de identidade: `PUT /identity` grava só em `organization.settings` e nunca toca o `Agent`. O cliente renomeia a IA e nada muda em produção, porque o orquestrador prefere o `Agent` do banco |

## Dano real medido em produção (14/07)

Confirmado por query, não por suposição:

- **Nenhum patch aplicado por cliente.** As 30+ `agent_eval_fix_decisions` são todas da org ZappIQ, aplicadas pelo próprio Rodrigo na Iza. O prompt da Vera está intacto.
- **Nenhuma mensagem vazada.** CMJ, MACHIA, Antonella e Felix não têm tráfego de WhatsApp. Zero mensagens citando `zappiq.com.br`.
- **O que o CMJ viu:** score 52% (13/07) e 44% (06/07), com 3 falhas críticas, e sugestões mandando a Vera falar em nome da ZappIQ.

### A prova numérica

| Agente | Score | Falhas críticas |
|---|---|---|
| Iza (ZappIQ) | 92% a 100% | sempre 0 |
| Todo cliente | 36% a 60% | sempre 3 a 4 |

Decomposição dos 25 cenários aplicados à Vera:

| Tipo | Qtd | Vera passou |
|---|---|---|
| Exclusivos da ZappIQ | 7 | 3 |
| CR contaminados com marca/preço/link | 11 | 4 |
| **Universais e legítimos** | **7** | **6 (86%)** |

**A Vera não tem 52%. Ela tem 86% no que de fato mede qualidade.** 72% da prova era sobre a ZappIQ.

## Plano de correção

### Onda 0: estancar (hoje)

Bloquear `apply-fix` para org diferente da Iza e desabilitar a aba até a Onda 2 subir. O cron de clientes roda segunda 04:30 UTC (próximo: 20/07), então há folga, mas o cliente pode clicar "Executar teste agora" a qualquer momento.

### Onda 1: o núcleo

1. `config/zappiqOrg.ts`: extrair `IZA_ORG_ID` (hoje duplicado em 6 arquivos) e expor `isZappIQOrg(orgId)`.
2. `agents/tenantAgentProfile.ts`: `resolveTenantAgentProfile(orgId)` retorna `{ orgId, isZappIQ, agentName, businessName, niche, tone, siteUrl, servicos, precos, regras, temPrecos, temServicos }`, lendo de `Organization.settings` + `Agent` + `settings.surveyAnswers.identidade_empresa`. **Sem fallback para a Iza. Nunca.**
3. `agents/tenantIsolationGuard.ts`: `assertNoForeignBrand(text, profile)` bloqueia `Iza`, `ZappIQ`, `zappiq.com.br`, `cal.com/rodrigoghetti`, `R$ 197`, `Voice 200`, `Starter/Growth/Scale`, `14 dias grátis` quando `!isZappIQ`.

### Onda 2: Qualidade da IA (o pedido explícito)

4. Dividir `agentEvalSet.ts` em `evalSetUniversal.ts` (factories `(profile) => EvalScenario`) e `evalSetZappIQ.ts`.
5. `resolveEvalSet(profile)`: universal, mais os da ZappIQ só se `isZappIQ`. Cenários **condicionais ao que o cliente treinou**: o de preço só roda se `profile.temPrecos`.
6. `executeAgentEvalRun(scenarios, agent, profile)`: passa a receber o profile e monta o prompt via `buildSystemPromptForContact` (o de produção, com RAG) em vez do mock atual, que hoje testa um prompt que não existe.
7. `runJudge(expected, response, profile)`: o juiz recebe quem é o agente e é proibido de penalizar por não citar empresa/produto/preço de terceiros.
8. `suggestFix(..., profile)`: proibido sugerir identidade, marca, link ou preço de terceiros. `assertNoForeignBrand` antes de exibir e antes de gravar.
9. Cron: escolhe o set por org.
10. UI: "N cenários não rodaram porque falta preencher X em Treinar IA". Vira driver de engajamento em vez de reprovação.

### Onda 3: os vazamentos que chegam ao lead

11. `promptEngine.ts`: remover o bloco de URLs da ZappIQ. URLs vêm do profile. Sem URL cadastrada, o bloco não entra.
12. `blockedVerticalFilter.ts`: separar compliance legal (vale para todos, sem citar marca) de política comercial da ZappIQ (só na org da ZappIQ). **Decisão do fundador.**
13. `schedulingTools.ts:149`: "Agendado por {agentName}, IA de {businessName}".
14. `coreAgentRules.ts`: remover marca e ofertas da ZappIQ.
15. `intentClassifier.ts`: rótulo `Iza:` vira `{agentName}:`; exemplos com SKU viram genéricos.
16. `impulsoStrategist.ts`: persona vira estrategista de `{businessName}`.
17. `tools.ts`: `internalOnly: true` em `get_org_billing_summary` e passar `isIzaOrg` no caller. Fecha antes da Fase 2 do Agendamento.

### Onda 4: UI do dashboard

18. Trocar "Iza" por `{agentName}` em Campanhas, Analytics, Conversas, Maestro e templates.

### Onda 5: testes (o "nunca mais")

19. `resolveEvalSet(profileCliente)` não contém marca estrangeira. Falha o CI se alguém adicionar cenário contaminado.
20. `getSystemPrompt({ businessName: 'CMJ' })` não contém `zappiq.com.br`.
21. Estender `agentOrchestrator.izaFacts.test.ts`: prompt de org != Iza sem marca ZappIQ.
22. `applyPatch` recusa diff com marca estrangeira.
23. `getToolsForContext({})` não inclui `get_org_billing_summary`.

### Onda 6: remediação de produção (exige OK explícito)

24. Backfill dos 14 prompts: remover o bloco de URLs da ZappIQ, com snapshot antes e script de revert.
25. Runs antigas dos clientes: marcar inválidas (preservar auditoria) e esconder da UI.
26. Re-rodar o eval da Vera com o set novo.

### Onda 7: verificação

27. Evidência antes/depois: as perguntas feitas à Vera e o score real.

## Decisões pendentes do fundador

1. **Verticais bloqueadas**: apostas, MLM e cripto são política comercial da ZappIQ. Aplicar só na ZappIQ e liberar o cliente, ou manter um filtro genérico de compliance para todos sem citar a marca?
2. **Scores antigos do CMJ**: apagar as runs ou marcar inválidas e avisar o cliente?
3. **Escopo**: executar as ondas 1 a 7 ou priorizar só a Qualidade da IA agora?
