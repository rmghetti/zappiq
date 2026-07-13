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

### 2026-06-11 · PR #249 · Navbar sempre clara (cosmetico)

**O que mudou:** Navbar com fundo glass claro permanente. Antes era transparente ate scrollY > 12px, o que sumia com logo e itens de menu (escuros) sobre heroes escuros como o do /blog V2. Borda + sombra continuam condicionadas ao scroll.

**Impacto na Iza:** Nenhum — mudanca puramente visual de UI. Label `no-iza-impact` tambem aplicado no PR.

**Acao no /admin/iza-knowledge:** Nenhuma.

**Smoke esperado:** N/A.

---

### 2026-07-13 · PR #259 · Reposicionamento V6 + decisoes do fundador

**O que mudou:** Landing reposicionada para a categoria "Operacao Autonoma de Atendimento e Vendas" (a Iza atende, vende e faz campanha; voce aprova, ela executa). Decisoes comerciais aplicadas: (1) plano Scale virou self-serve com trial de 14 dias (era sales-led "falar com especialista"); (2) SLA contratual 99,9% removido de TODA a comunicacao publica ate reformalizar a faixa; (3) Programa Fundadores (Cohort Founders 2026, 30% vitalicio) descontinuado; (4) Meta Business Partner: designacao obtida, formalizacao documental em andamento; (5) Mira Prospects passa a ter pricing publico; (6) Pricing ganhou seletor de add-ons. Planos ativos continuam Lite R$247 / Growth R$497 / Scale R$1.497 / Enterprise sob consulta (Starter e Business seguem descontinuados).

**Impacto na Iza — ela precisa passar a falar:**
- Categoria: "operacao autonoma de atendimento e vendas", nao "chatbot" nem "IA conversacional".
- Scale (R$ 1.497/mes): self-serve, com 14 dias gratis como os demais. PARAR de dizer que Scale e so "falar com especialista".
- Mira Prospects: add-on de inteligencia de oportunidades. Faixas Essencial R$ 297, Pro R$ 597, Scale R$ 1.197. Elegivel a partir do Growth, incluida no Enterprise, indisponivel no Lite.
- Add-ons do site: Radar 360 Pro R$ 397, Zap Impulso a partir de R$ 197, Agendamento pela IA R$ 49 (incluso do Growth pra cima), Voz Nativa a partir de R$ 79,90, Numero WhatsApp extra R$ 137.
- Meta Business Partner: podemos nos apresentar como Meta Business Partner (designacao obtida; certificado/ID em formalizacao). Conexao oficial via Cloud API direto Meta.

**Impacto na Iza — ela precisa PARAR de falar:**
- SLA / uptime 99,9% contratual (removido da comunicacao publica ate reformalizar).
- Programa Fundadores / Cohort Founders / 30% vitalicio (campanha descontinuada).
- Qualquer plano Starter ou Business (descontinuados).
- "BSP homologado via 360Dialog" como infra propria (usamos Cloud API direto Meta).

**Acao no /admin/iza-knowledge** (apos merge):
- [ ] UPDATE facts de pricing: Scale self-serve/trial; adicionar faixas Mira; adicionar add-ons do Pricing.
- [ ] UPDATE fact de posicionamento: categoria "operacao autonoma de atendimento e vendas".
- [ ] SUNSET/DELETE facts: SLA 99,9% contratual; Programa Fundadores; Starter/Business.
- [ ] UPDATE fact de parceria Meta: "Meta Business Partner (em formalizacao)".

**Smoke esperado:**
- "O plano Scale tem trial?" -> "Sim, 14 dias gratis, self-serve." (nao mais "fale com um especialista")
- "Voces tem Programa Fundadores?" -> Iza NAO oferece mais a campanha.
- "Qual o SLA de voces?" -> Iza fala de infraestrutura/monitoramento, sem cravar 99,9% contratual.
- "Quanto custa a Mira Prospects?" -> "A partir de R$ 297/mes (Essencial), disponivel do Growth pra cima."
