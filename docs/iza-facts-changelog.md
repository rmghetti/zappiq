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

### 2026-08-20 · PR #343 · Bandeira nova "por atendimento" + kit Outubro sem Susto

**O que mudou:** toda a copy do site trocou a bandeira "mensalidade fixa sem cobrança por conversa" pela nova: "Mensalidade fixa por atendimento: cada conversa que a Iza cuida conta um, com mensagens à vontade dentro dela. A tarifa do WhatsApp vai a custo, na sua conta, com medidor e teto. Zero markup, zero setup, zero surpresa." Fair use de 12 respostas por atendimento aparece em linha visível. A página /novidades-meta virou o kit "Outubro sem susto" (calculadora da tarifa Meta de 01/10, referência R$ 0,035 por resposta, tabela final até 01/09) e nasceu /legal/subprocessadores. Decisões D1/D2 do plano Resposta Meta, aprovadas pelo fundador em 20/08.

**Impacto na Iza:** a Iza NÃO pode mais afirmar "sem cobrança por conversa" nem "mensagens ilimitadas" secas. Passa a falar: mensalidade fixa por atendimento (conversa que se encerra após 72h de silêncio), mensagens à vontade dentro do atendimento com fair use de 12 respostas de IA, tarifa do WhatsApp é da Meta e vai a custo na conta do cliente (zero markup), com medidor (Conta Clara) e teto (Cost Guard) dentro da plataforma, e a partir de 01/10 a Meta cobra cada resposta (referência R$ 0,035; tabela final até 01/09). Para dúvida de custo, apontar zappiq.com.br/novidades-meta.

**Ação no /admin/iza-knowledge** (após merge):
- [ ] UPDATE fact de pricing/bandeira: remover "sem cobrança por conversa", inserir a bandeira nova com o fair use (status: live)
- [ ] CREATE fact `meta_tarifa_outubro` em pricing (cobrança da Meta a partir de 01/10, a custo, medidor e teto; link /novidades-meta; status: live)
- [ ] Smoke test no chat da Iza: perguntar "vocês cobram por conversa?" e "quanto vou pagar de WhatsApp em outubro?"

### 2026-07-16 · PR #308 · Mira no catálogo comercial + cupom em todo produto pago

**O que mudou:** As 3 faixas do Mira Prospects (Essencial R$ 297/mês, Pro
R$ 597/mês, Scale R$ 1.197/mês; anual −20%) e o pacote avulso passaram a ser
registrados em `ADDONS_V4_LIST` (planConfig.ts) — antes só existiam no registry
do Stripe, então eram invisíveis para o catálogo de cupons. Todo produto pago
agora aceita cupom no checkout (o pacote avulso ganhou o campo). Corrigido um
bug: cliente em teste grátis do Mira não compra pacote avulso (precisa assinar
uma faixa antes).

**Impacto na Iza:** Se um cliente perguntar, ela pode confirmar que o Mira tem
faixas com preço (Essencial/Pro/Scale) e que **existe cupom de desconto para o
Mira** (antes era impossível emitir). E que o **teste grátis do Mira é um teto
de 10 Alvos vitalício** (não por dias, não renova no mês) — para continuar,
assina uma faixa; o pacote avulso só serve para quem já tem faixa. Nada disso a
Iza afirmava antes; o risco é ela dizer "o Mira não tem cupom" ou "seu teste
renova mês que vem", ambos falsos agora.

**Ação no /admin/iza-knowledge** (após merge):
- [ ] UPDATE/CREATE fact do add-on Mira: faixas + preços + que aceita cupom
- [ ] CREATE fact do teste grátis do Mira: teto de 10 Alvos vitalício, vira
      faixa para continuar (não confundir com o trial de 14 dias do plano)

**Smoke esperado:** "O Mira tem desconto?" → Iza confirma que há cupom para as
faixas do Mira. "Meu teste do Mira renova mês que vem?" → Iza explica que é um
teto único de 10 Alvos e que para continuar assina uma faixa.

---

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

---

### 2026-07-14 · PR #274 · Tira marca da ZappIQ do prompt do CLIENTE (não da Iza)

**O que mudou:** `coreAgentRules.ts` foi de v1 para v2 e `promptEngine.ts` removeu o
bloco `### URLs canônicas ZappIQ`. Objetivo: o prompt do agente de CADA CLIENTE (Vera do
CMJ, Bia da Loja X etc.) parou de levar marca/link/oferta da ZappIQ, porque a Vera
mandava lead do CMJ pro nosso cadastro. `CORE_AGENT_RULES_V1` é prependado ao prompt de
TODA org, inclusive a da Iza, então o path sensível dispara o gate.

**Impacto na Iza:** Nenhum nos FATOS que ela fala. Conferido linha a linha:
- O que saiu de `coreAgentRules.ts` são EXEMPLOS ilustrativos dentro de templates de
  formato de resposta — `[1 friction-reducer: sem cartão / 14 dias grátis / etc]` e
  `"Os planos disponíveis são: Starter, Growth, Scale..."` — não fatos. Viraram genéricos
  (`[benefício do SEU negócio]`, `"A, B, C..."`).
- Os fatos reais que a Iza fala (trial, planos, preços, Mira, add-ons — ver entrada
  13/07 acima) vêm da tabela `iza_facts` via `getIzaFactsBlock()`, que é um mecanismo
  completamente separado de `coreAgentRules.ts` e não foi tocado aqui.
- O bloco `### URLs canônicas ZappIQ` removido do `promptEngine.ts` só afeta o FALLBACK
  (org sem `Agent` seedado). A Iza tem `Agent.systemPrompt` próprio com ~27k chars de
  patch acumulado — nunca passa por esse fallback em produção.
- `CORE_RULES_VERSION` (v1→v2) só alimenta label de auditoria de eval run
  (`adminAgentEval.ts`, `agentQuality.ts`, `agentEvalCronService.ts`), não é lida em
  nenhuma branch de comportamento.

**Ação no /admin/iza-knowledge:** Nenhuma. Não há fact novo, atualizado ou removido.

**Smoke esperado:** Nenhuma mudança no que a Iza responde. "Quais os planos?",
"tem trial?" e "qual o link de cadastro?" continuam saindo do `factsBlock`, idênticos a
antes do PR.
