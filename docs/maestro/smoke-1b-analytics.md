# Smoke 1B-Analytics — Funil/Drop-off por Nó (validação manual)

> Captura contadores pré-agregados por nó/dia (`flow_node_stats`) e exibe no canvas.
> Testes unitários cobrem motor (`visitedNodeIds`), `aggregate`, `recordNodeStats` e a rota.
> Este roteiro valida a captura real + a visualização.

## Pré-requisitos
- Migração `20260614_flow_node_stats` aplicada (`prisma migrate deploy` no release).
- Org com `maestro.enabled=true`, número WhatsApp sandbox, 1 fluxo ativo.

## Casos

1. **Captura ao rodar** — enviar algumas mensagens que disparem o fluxo (várias conversas/contatos).
   - No banco: `SELECT "nodeId","entries","ends" FROM flow_node_stats WHERE "flowId"=...` deve ter linhas, com `entries` subindo por nó visitado e `ends>0` no nó onde o fluxo encerra. ✓

2. **Visualização no canvas** — abrir o fluxo no editor, clicar **"Métricas"**.
   - Cada nó mostra um badge `▶ entries` (e `⏹ ends` no terminal). Resumo no topo: `· N (7d)`. ✓
   - Drop-off visível: nó com muitas entradas cujos sucessores têm bem menos. ✓

3. **Toggle/Fail-soft** — desligar "Métricas" → badges somem; editar/salvar o fluxo normalmente (os badges NÃO contaminam o JSON salvo). Se a rota de analytics falhar → canvas normal, sem badge. ✓

4. **Isolamento por org** — `GET /api/flows/:id/analytics` de um fluxo de outra org → 404; nunca vaza linhas de outra org (RLS + escopo duplo). ✓

5. **Retomada por timer** — fluxo com `wait`; quando o timer dispara e retoma, os nós percorridos na retomada também contam (emissão no `flowScheduler`). ✓

6. **Cadeia goto_flow** — fluxo A que salta para B no mesmo turno: tanto A quanto B registram entradas (registro por hop). ✓

## Observações
- Período = data UTC (`YYYY-MM-DD`); `?days=N` (1–90, default 7).
- Emissão é **fail-soft**: erro de DB nunca derruba o turno/timer.
- Upsert atômico (`ON CONFLICT`) — sem race sob concorrência.
- Modelo pré-agregado (uma linha por nó-dia) — não reconstrói jornadas individuais (event log cru ficaria para o Pacote 2 se necessário).
