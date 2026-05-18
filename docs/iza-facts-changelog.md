# Iza Facts Changelog (Camada 3 anti-drift)

> Este arquivo é a **interface humana** da Camada 2 (`iza_facts` table).
> Toda vez que você muda algo que afeta o que a Iza fala, registra aqui.
> O CI gate (`scripts/check-iza-drift.sh`) bloqueia merge em PRs que tocam
> paths sensíveis sem atualizar este arquivo (ou ter label `no-iza-impact`).

## Como usar

1. **Antes do merge** do PR que toca landing/planConfig/coreAgentRules/etc:
   - Adicione uma entrada nova abaixo descrevendo o impacto
   - Indique se precisa criar, atualizar ou desativar facts no DB
2. **Depois do merge**, abra `/admin/iza-knowledge` e execute a ação descrita
   - UPDATE em fact existente → reflete em ≤60s na Iza
   - INSERT novo fact → idem
   - DELETE soft → idem
3. **Smoke test** no chat da Iza pra confirmar que ela fala certo

## Paths que disparam o gate

- `apps/web/components/landing/**` — copy do site
- `apps/web/app/(marketing)/**` — páginas marketing
- `packages/shared/src/planConfig.ts` — tiers + preços
- `apps/api/src/agents/coreAgentRules.ts` — regras imutáveis
- `apps/api/src/agents/promptEngine.ts` — prompt fallback
- `apps/api/src/agents/nichePrompts.ts` — prompts por niche
- `fly.toml` — env vars de prod

Pra contornar (PRs cosméticos): adicione label `no-iza-impact` no PR.

---

## Formato de entrada

```
### YYYY-MM-DD · PR #NNN · Título curto

**O que mudou:** descrição executiva.

**Impacto na Iza:** o que a Iza precisa passar a falar / parar de falar.

**Ação no /admin/iza-knowledge** (após merge):
- [ ] CREATE fact `xxx` em `section` (label: ..., status: live)
- [ ] UPDATE fact `yyy` mudando `status: live → sunset`
- [ ] DELETE soft `zzz`
- [ ] Nenhuma (mudança técnica sem impacto narrativo)

**Smoke esperado:** "pergunta de teste no chat" → "resposta esperada"
```

---

## Entradas

### 2026-05-17 · PR #155 · Camada 2 iza_facts + Markdown links

**O que mudou:** Criada tabela `iza_facts` (single source-of-truth pra fatos da plataforma), injetada em runtime no system prompt da Iza em todos os canais (WA + IG + chat web). Chat web ganha renderização de links Markdown.

**Impacto na Iza:** Agora ela tem bloco "FATOS ATUAIS DA PLATAFORMA" overlayado por cima do prompt seedado v7.6. Conflitos são resolvidos pelo overlay (fatos atuais ganham).

**Ação no /admin/iza-knowledge:** N/A — seed inicial feito via migration (15 facts: 3 canais, 5 features, 5 URLs, 2 compliance).

**Smoke esperado:** "Vocês têm Instagram?" → Iza confirma LIVE com piloto (não mais "não está no roadmap").

---

### 2026-05-17 · PR #157 · Camada 3 anti-drift gate

**O que mudou:** Adicionado GitHub Action que bloqueia PRs sensíveis sem atualizar este arquivo OU ter label `no-iza-impact`.

**Impacto na Iza:** Nenhum direto. Indireto: previne futuros drifts ao forçar autor a registrar impacto.

**Ação no /admin/iza-knowledge:** Nenhuma.

**Smoke esperado:** N/A.

---

<!-- Próximas entradas aqui. Não delete entradas antigas (histórico). -->
