# Smoke 1B — Geração de Fluxos Ricos por IA (validação manual)

> A 1B ensina a IA do Maestro a gerar fluxos **ricos** (ask, perguntas com botões, ramos)
> via composição de blocos validados. Os testes unitários cobrem blocos/montador/validação
> e o pipeline com LLM mockado. Este roteiro valida a geração real ponta a ponta.

## Pré-requisitos
- Org com `settings` preenchido no treinamento da IA (survey, identidade, idealmente alguns Q&A/documentos) — quanto mais rico o `brief`, melhor o plano gerado.
- Acesso ao Maestro Inteligente / Arquiteto de Jornada no dashboard (os endpoints que chamam `generateSmartFlows` / `generateJourney`).

## Casos

1. **Geração rica de um objetivo** — disparar a geração para um objetivo (ex.: Qualificação).
   - Abrir o draft no canvas. Esperado: o fluxo tem **mais que o esqueleto fixo** — ao menos um nó `ask` (Perguntar e capturar) e/ou um `ask_buttons` (mensagem com botões → condição ramificando por opção). `source` do draft = `ai-rich`. ✓
   - Conferir que os botões têm títulos reais do negócio e que cada ramo leva a um nó-IA/tag coerente.

2. **Auditabilidade no canvas** — o fluxo gerado renderiza corretamente (nó ask com inspetor, condição com chips de predicado, mensagem com botões) — porque os shapes são os mesmos da 1A. ✓

3. **Publicação** — publicar o fluxo gerado. A `validateGraph` do editor **não** deve bloquear (o montador já garante ramo padrão/ids únicos/limites). Se bloquear, é bug. ✓

4. **Execução real** — enviar mensagem para o número e tocar um botão gerado → o fluxo ramifica pelo título (motor 1A). ✓

5. **Fallback gracioso** — forçar/observar um cenário em que o LLM devolve algo inválido (ou indisponível): a geração **não quebra**; cai no fluxo de blueprint simples (`source` = `ai` ou `fallback`), ainda publicável. ✓

6. **Arquiteto de Jornada** — gerar a jornada completa (vários objetivos): cada fluxo especialista sai **rico**, e os handoffs entre fluxos continuam desenhados como antes. ✓

## Observações
- Geração roda 1x por fluxo (DRAFT, não persiste) — o cliente revisa/edita/salva, como hoje.
- No fallback, há 2 chamadas de LLM (rica + content-fill) — esperado; em regime normal só a rica dispara. Se a taxa de fallback subir muito numa jornada com vários objetivos, considerar o short-circuit (TODO).
- Sem mídia gerada por IA (decisão de escopo 1B): mídia é inserção manual no editor.
- Sem ramos por atributo de CRM gerados por IA: ramos gerados usam botão/variável/horário (auto-contido). CRM-branching é manual no canvas.
