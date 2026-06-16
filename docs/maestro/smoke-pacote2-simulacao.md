# Smoke — Simulação por Personas Sintéticas (Pacote 2.8)

> Antes de publicar, o Maestro testa o fluxo com clientes sintéticos (gerados do brief
> do negócio) e reporta se ele lidou bem. Reusa o motor puro (`resolveFlowStep`), o juiz
> da Qualidade da IA (`runJudge`) e o `loadBusinessContext`. Backend 100% testado (15 testes:
> `scoreConversation` puro + `runOnePersona` com motor real + geração/orquestração mockada).

## Pré-requisitos
- Org com brief preenchido no treinamento da IA (quanto mais rico, melhores as personas).
- Um fluxo aberto no editor (não precisa estar salvo — simula o rascunho atual).

## Casos
1. **Simular rascunho** — abrir o fluxo → botão **"Simular"**.
   - O Maestro gera ~3 personas (intenções variadas: comprar, dúvida, objeção…), cada uma conversa com o fluxo, e um juiz pontua. Abre um modal com **passRate%**, lista por persona (✓/✗ + motivo) e sugestões. ✓
2. **Fluxo que trava** — um fluxo com um beco sem saída (condition sem ramo padrão, ask que não encerra) → personas "não encerram" → falham, com motivo "a conversa não encerrou". ✓
3. **Fail-soft** — brief pobre/LLM indisponível → personas genéricas (fallback) e/ou veredito de erro naquela persona, sem quebrar o lote nem o editor. ✓
4. **Sinergia Qualidade da IA** — o veredito de cada ponto de nó-IA usa o mesmo juiz (`runJudge`) do pipeline de qualidade. ✓

## Observações
- É uma **simulação aproximada** (clientes gerados por IA) — sinal, não garantia. O modal avisa isso.
- Limites: `personaCount` 1–8 (default 3), `maxTurns` 6 por conversa → custo de LLM limitado por request (on-demand, não em loop).
- Não simula timers reais (`wait`/`schedule` = "encerrou" para fins de simulação) nem toques de botão de verdade (a persona responde por texto).
- Rota: `POST /api/flows/:id/simulate` (org-scoped; aceita `nodes`/`edges` do rascunho no body).
- Diferencial verificado: nenhum concorrente testa o fluxo com clientes sintéticos antes de publicar.
