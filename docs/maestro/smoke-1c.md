# Smoke 1C — Subfluxos Call/Return (validação manual)

> Um fluxo chama outro (`goto_flow` modo "Chamar e voltar") e retoma no nó seguinte
> quando o subfluxo termina. `callStack` persiste no cache, então subfluxos funcionam
> entre turnos. Testes cobrem `nextHopIntent` (puro) e o ciclo call→return no runtime
> (`flowRuntime.subflow.test.ts`, com motor/router reais).

## Pré-requisitos
- Org com `maestro.enabled=true`, número WhatsApp sandbox.
- Dois fluxos ativos: um **chamador** e um **subfluxo** (SUB). O SUB pode ter trigger MANUAL (só alcançado via call).

## Casos

1. **Call + return num turno** — Chamador: `start → goto_flow(SUB, modo "Chamar e voltar") → message("voltei")`. SUB: `start → message("no sub")`.
   - Disparar o chamador. Esperado: o cliente recebe **"no sub"** e depois **"voltei"** (chamou o SUB, voltou e seguiu). ✓

2. **Subfluxo cross-turn (com ask)** — SUB com um nó `ask` que aguarda resposta.
   - Disparar o chamador → recebe a pergunta do SUB e o fluxo pausa. Responder → o SUB captura, termina, e o chamador **retoma no nó seguinte** ("voltei"). A pilha sobreviveu ao turno. ✓

3. **Reuso** — vários chamadores diferentes apontando para o mesmo SUB (ex.: um subfluxo "qualificar"): cada um chama e retoma no seu próprio ponto. ✓

4. **Modo "Enviar" (one-way) inalterado** — `goto_flow` modo "Enviar para o fluxo (não volta)": salta e não volta, exatamente como antes (retrocompat). ✓

5. **goto_flow call como último nó** — chamador cujo `goto_flow(call)` não tem nó depois (`returnNodeId` null): ao voltar, o chamador **encerra** (não reinicia, não duplica mensagens). ✓

6. **Aninhado** — A chama B, B chama C: ao C terminar, volta a B; ao B terminar, volta a A. ✓

## Observações
- Retrocompat: `goto_flow` sem modo = one-way idêntico ao de hoje; sem `callStack` = sem subfluxos.
- Anti-loop `MAX_FLOW_HOPS` limita call/return infinitos (recursão acidental encerra com aviso).
- `vars` são compartilhadas entre chamador e subfluxo (o subfluxo pode capturar dados que o chamador usa depois).
- A pilha vive no cache (TTL 7d); se expira no meio, a conversa recomeça pelo roteador.
