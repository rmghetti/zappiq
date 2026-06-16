# Smoke — Auto-otimização de Fluxo (Pacote 2.7)

> O Maestro lê o funil por nó (1B-analytics), acha o nó de maior abandono e propõe
> uma reescrita do texto com diff (reusa a Atualização Inteligente). Backend testado
> (`rankDropoffNodes` puro + `generateOptimizationSuggestion` com LLM mockado + rota).

## Pré-requisitos
- Um fluxo ativo que **já rodou com vários clientes** (precisa de dados no funil — `flow_node_stats`).
- Migração `flow_node_stats` aplicada.

## Casos
1. **Sugestão com dados** — abrir o fluxo no editor → botão **"Otimizar"**.
   - O Maestro identifica o nó `message`/`ai` com maior drop-off e mostra um **diff** (texto antigo → novo) com a nota explicando "este nó perdia ~X% dos clientes". Aprovar aplica via Atualização Inteligente (snapshot + estrutura travada). ✓
2. **Sem dados suficientes** — fluxo novo/sem tráfego → "Otimizar" mostra a nota amigável "ainda não há dados suficientes…" e o Aplicar fica desabilitado (fallback). ✓
3. **Estrutura intacta** — só o texto de UM nó muda; ids/tipos/arestas preservados (a aplicação revalida `sameStructure`). ✓
4. **Fail-soft** — LLM indisponível → fallback, sem quebrar o editor. ✓

## Observações
- Só reescreve nós `message`/`ai` (drop-off em condition/ask é estrutural, não de copy).
- Sempre human-in-the-loop: o Maestro **propõe**, o cliente **aprova** (nunca auto-aplica).
- Diferencial verificado: nenhum concorrente entrega "fluxo que mede onde abandonam e propõe a versão melhorada".
- Aplicação reusa a rota `refresh-apply` existente (mesmo shape `FlowRefreshResult`).
