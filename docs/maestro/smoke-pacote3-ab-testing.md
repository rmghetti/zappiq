# Smoke — A/B Traffic Split — Pacote 3.10

> Testa **duas versões de um fluxo** (A = fluxo atual, B = um fluxo variante) com **% de
> tráfego** e compara a **conversão** de cada variante. Atribuição determinística por conversa
> (mesma conversa nunca troca de variante). Backend testado: `assignVariant` + `computeAbResults`
> (puros, 8 testes); runtime gated/fail-soft (sem regressão para fluxos sem experimento); rotas
> `PUT/GET /flows/:id/experiment` (58 testes de rota verdes).

## Pré-requisitos
- Org com `maestro.enabled=true`, número WhatsApp sandbox.
- **Dois** fluxos ativos: o fluxo A (que recebe tráfego de entrada via roteador) e um fluxo B
  variante (outra versão do mesmo objetivo). Ambos com nó de entrada e algum nó de "conclusão".

## Configurar (no editor)
1. Abrir o fluxo **A** → botão **"A/B"** na toolbar → abre o painel "Experimento A/B".
2. Ligar **"Ativar teste A/B"**.
3. **Fluxo variante (B)**: selecionar o outro fluxo ativo (o select exclui o fluxo atual e lista só ativos).
4. **% do tráfego para B**: slider 0–100 (ex.: 50 = metade das conversas novas vão pra B).
5. **Nó de conversão** (opcional): escolher o nó que conta como conversão; vazio = "Conclusão do fluxo".
6. **Salvar**. (Validação: ativar exige um `variantFlowId` ≠ do próprio fluxo; senão a API retorna erro e aparece no topo.)

## Casos
1. **Atribuição determinística** — abrir conversas de números diferentes contra o fluxo A.
   - Com split 50, ~metade das conversas novas entram no fluxo B (verificável pela diferença de
     copy/mensagens entre A e B). A **mesma** conversa, em turnos seguintes, permanece na variante
     que pegou (não re-sorteia). ✓
2. **Split 0** — % pra B = 0 → todas as conversas novas ficam em A (retrocompat total). ✓
3. **Split 100** — % pra B = 100 → todas as conversas novas vão pra B. ✓
4. **Variante inativa/inexistente** — desativar o fluxo B (ou apagá-lo) → o experimento degrada
   com segurança: conversas novas seguem em A (fail-soft, sem quebra). ✓
5. **Resultados** — após algum tráfego, reabrir o painel "A/B": mostra, por variante (A e B),
   `entradas`, `conversões` e `taxa de conversão %`. Com amostra suficiente nas duas, destaca o
   **vencedor** (borda verde + selo "Vencedor"); sem amostra → nota "sem dados suficientes" (sem
   declarar vencedor). ✓
6. **Desligar** — desativar o experimento não migra conversas em andamento (cada uma segue no seu
   fluxo); só para de sortear novas. ✓

## Observações
- **Sem migração:** o experimento vive em `org.settings.experiments[flowAId]` = `{ active,
  variantFlowId, splitPercent, conversionNodeId? }`. Nada novo no schema.
- **Conversão = funil 1B-analytics:** cada variante é um fluxo, então já tem `FlowNodeStat` por nó.
  Conversão = `entries(conversionNodeId) / entries(nó de entrada)`; sem `conversionNodeId` →
  `sum(ends)/totalEntries` (taxa de conclusão). Janela padrão 14 dias (`?days=`).
- **Seed = conversationId** (hash FNV-1a determinístico) + o `flowId` persistido no estado reforça
  que a conversa não troca de variante entre turnos.
- **Escopo v1:** 2 variantes, split %, conversão por funil, config + resultados. Fora: >2 variantes,
  significância estatística formal (mostra taxas + vencedor simples), auto-promoção da vencedora
  (só reporta), multi-armed bandit.
