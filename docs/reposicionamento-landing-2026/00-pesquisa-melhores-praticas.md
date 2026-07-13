# Brief de melhores práticas: reposicionamento e atualização da landing da ZappIQ

**Autor:** Head de Marketing de Produto
**Data:** 10/07/2026
**Objetivo:** consolidar a pesquisa verificada em um guia único, priorizado e citado, para reposicionar a ZappIQ de "plataforma de IA conversacional para os canais Meta" para **plataforma agêntica completa de atendimento, vendas e campanhas, com CRM integrado, que opera a operação do cliente de ponta a ponta**.

## Como ler este brief

- Toda afirmação traz a fonte (URL) ao lado. Quotes de concorrentes foram verificados ao vivo em 10/07/2026, salvo nota em contrário.
- Números próprios da ZappIQ (Iza resolve ~65%, conversão +30%, payback 90 dias) são **ilustrativos, base beta**, e só entram na landing com a mesma moldura de disclaimer que já existe em `blogData.ts`. Nunca apresentar número beta como métrica de caso auditado.
- Claims de fato com risco jurídico (Meta Business Partner, dados no Brasil, SLA 99,9%, incidentes em 72h, "dados não treinam modelos") só vão ao ar depois de confirmação de engenharia e jurídico.
- Regra de copy MACHIA: português do Brasil com acentuação completa, sem travessão. Vírgula, dois-pontos ou ponto no lugar.

### Divergências de código já confirmadas nesta análise (repo `~/zappiq-main`)

Verifiquei o código real antes de escrever o brief. Achados que devem virar correção antes de qualquer publicação:

| # | Achado | Local | Ação |
|---|--------|-------|------|
| A | **Dois planos marcados como "Mais Popular"**: `IZA_LITE` (L89) e `GROWTH` (L198) têm `highlight: true` ao mesmo tempo; `Pricing.tsx` L121 (`isHighlight`) pinta o selo nos dois (L150). | `packages/shared/src/planConfig.ts` + `apps/web/components/landing/Pricing.tsx` | Deixar `highlight` só no Growth. Anula a âncora ter dois destaques. |
| B | **Trial de 14 dias inconsistente**: só `IZA_LITE` define `trialDays: 14`; o Growth não define `trialDays`, mas o CTA promete "14 dias grátis". | `planConfig.ts` L92 vs bloco Growth (L191+) | Definir `trialDays` no Growth para casar copy com enforcement. |
| C | **Metadata de /precos cita plano descontinuado**: `title` lista "Starter" e a `description` diz "a partir de R$ 197/mês". Starter está `deprecated: true` (L141, R$ 197); a entrada real hoje é Lite R$ 247. | `apps/web/app/precos/page.tsx` L8 e L12 | Trocar por Lite/Growth/Scale/Enterprise e "a partir de R$ 247/mês, zero setup fee, 14 dias grátis". |
| D | **Baseline Enterprise só existe como comentário**: `priceMonthly: null` com `// a partir de R$ 9.900/mês` (L368). | `planConfig.ts` L363-370 | Publicar "a partir de R$ 9.900/mês" é decisão comercial do Rodrigo, não regra de UX. Não expor sem aprovação. |

Planos ATIVOS confirmados no código (julho/2026): **Lite R$ 247, Growth R$ 497, Scale R$ 1.497, Enterprise sob consulta**. Legados ocultos: Starter R$ 197 e Business R$ 1.997 (`deprecated: true`, já filtrados na UI). A tabela oficial de junho bate com o código, com a ressalva C acima na metadata.

---

## 1. Como as plataformas agênticas líderes se posicionam (padrões de categoria e de hero)

### 1.1 A categoria virou "agente autônomo", não "chatbot"

Nenhum líder se posiciona mais como chatbot ou plataforma conversacional. O vocabulário de categoria migrou para agente autônomo, e o verbo passou de "responder" para "resolver".

- Sierra: **"Agent OS: Build, optimize, personalize, and scale the best AI agents"** (fonte: https://sierra.ai).
- Intercom/Fin: **"pioneering the Customer Agent"** (fonte: https://www.intercom.com/fin).
- Zendesk BR, já em português: **"agentes de IA são sistemas autônomos... capazes de raciocinar em solicitações de múltiplas etapas"**, em oposição a "chats tradicionais" (fonte: https://www.zendesk.com.br/service/ai/).
- Salesforce: **"digital labor"** (fonte: https://www.salesforce.com/agentforce/).

**Implicação para a ZappIQ (higiene de categoria, não moat):** trocar "plataforma de IA conversacional" por "plataforma agêntica"/"agente autônomo" e banir "chatbot" e "conversacional" do topo. Atenção: como o Zendesk já roda toda a narrativa agêntica em pt-BR no Brasil, "agentic" é pré-requisito para não parecer datado, **não um diferencial defensável**. Não vender "agêntico" como se fosse inédito, a Zaia já ocupou o termo "Agentic OS" no Brasil (fonte: https://zaia.app).

### 1.2 Hero vende desfecho, não tecnologia

A manchete de herói dos líderes promete resultado ou experiência, nunca a feature seca.

- Gorgias: **"Conversations that drive revenue, not just resolutions"** (fonte: https://www.gorgias.com).
- Crescendo: **"Total Outcome Guarantee across speed, quality, and customer satisfaction"** (fonte: https://www.crescendo.ai).
- Intercom/Fin: **"Perfect customer experiences"** (fonte: https://www.intercom.com/fin).

**Implicação:** a manchete da ZappIQ deve prometer o desfecho (a operação de atendimento e vendas rodando com ganho mensurável), não "plataforma de IA para os canais Meta". Casa com a voz MACHIA "prova antes de promessa".

### 1.3 Números de resultado no hero e cards de métrica por caso

Padrão recorrente: faixa de 3 a 4 números logo abaixo do hero, mais cards por caso (logo, número, quote, cargo).

- Fin: **76% de resolução média em 12.000+ clientes** (fonte: https://www.intercom.com/fin).
- Gorgias: **"$500M+ revenue driven through conversations"**, **"4.2x average return on investment"**, mais casos 8,83x e 19,2x (fonte: https://www.gorgias.com).

**Implicação:** usar a Calculadora ROI e o cohort Founders 2026 como faixa e cards, **sempre rotulados como ilustrativos** enquanto a base de casos reais cresce. O disclaimer já existe em `blogData.ts` e deve ser espelhado.

### 1.4 Agente personificado com nome e frame de "contratar"

Gancho forte, sobretudo nos agentes de vendas.

- Fin: **"22 reasons to hire Fin"**; motivo 21: **"we were first to introduce outcome based pricing"** (fonte: https://www.intercom.com/fin).
- Artisan: **"Hire Ava, the autonomous AI BDR"**, que "finds leads, sends personalized outreach, handles objections and books meetings" (fonte: https://www.artisan.co).

**Ressalva de escopo:** o frame "contrate um colega nomeado" é dominante nos agentes de vendas (Artisan, 11x em https://www.11x.ai, Qualified em https://www.qualified.com) e no Fin, **não universal**. Players de CX como Sierra e Decagon (https://decagon.ai) vendem "construa o SEU agente".

**Implicação:** elevar a Iza ao frame **"contrate a Iza"**, descrevendo em terceira pessoa, com verbos de ação autônoma, o que ela faz sozinha de ponta a ponta (atende, qualifica, vende, agenda, dispara campanha, atualiza o CRM). Encaixe natural, a Iza já é nomeada.

### 1.5 Agente único de ponta a ponta e omnichannel

- Fin: **"a single customer facing Agent that works across the customer journey, from day 1 to year 10"** (fonte: https://www.intercom.com/fin). Padrão de camada única cruzando chat, voz e e-mail, corroborado por Sierra, Decagon e Ada (https://www.ada.cx).

**Implicação:** vender a Iza como agente único de ponta a ponta (atendimento + vendas + campanhas) nos canais Meta (WhatsApp + Instagram Direct), em texto e áudio via Voz Nativa.

### 1.6 O loop de auto-melhoria é capacidade-estrela de todo líder

- Zendesk BR: **"Uma IA que melhora a cada resolução"**, **"Impulsionados pela Resolution Learning Loop"**, "Ela aprende continuamente com interações reais" (fonte: https://www.zendesk.com.br/service/ai/).
- Crescendo ancora no medo do decaimento: **"Most AI solutions fail after launch... performance decays. Knowledge goes stale"** (fonte: https://www.crescendo.ai).

**Implicação, com correção crítica:** dar seção própria, com peso de hero, ao **loop de auto-correção auditada** (detecta desvio/alucinação, dá score, sugere, humano aprova, plataforma aprende em ~3 min). Vender a **auditoria + aprovação humana** como diferencial concreto. **REMOVER da copy** qualquer alegação de ser "o único" do mercado com human-in-the-loop: concorrentes de CX têm QA e revisão humana, e a exclusividade é insustentável. O diferencial é a combinação (agêntico + auditado + humano aprova + aprende rápido), não a categoria isolada.

### 1.7 Precificação por resultado é arma de posicionamento dos globais, e a ZappIQ deve INVERTER

- Sierra: **"Pay for a job well done: ensure you only pay for the value Sierra delivers with outcome-based pricing"** (fonte: https://sierra.ai).
- Fin: **"only pay for Fin when it delivers value"** (fonte: https://www.intercom.com/fin).
- Crescendo: **"No setup fees... Never pay for dissatisfied AI-resolved interactions"** (fonte: https://www.crescendo.ai).

**Implicação:** **NÃO copiar cobrança por resolução** (quebraria a margem, o `planConfig` confirma tiers fixos e passthrough Meta com margem fina em disparos). Inverter o argumento: **preço fixo previsível, zero setup, sem cobrança por conversa de atendimento, trial 14 dias sem cartão**. É o mesmo território de confiança dos globais, pelo avesso, e ainda ataca o modelo por conversa dos concorrentes BR (seção 5).

### 1.8 Portfólio como ciclo (diretriz visual, não vantagem)

Sierra: **"Build, optimize, personalize, and scale"**; Parloa: "Design, Test, Scale, Optimize" (https://www.parloa.com); Zendesk: "Resolution Learning Loop". Confiança média: é convenção de design de landing (bento grid, tabs, ciclo), replicável e não é tese de posicionamento. Serve para organizar Maestro, Voz Nativa, Echo, Radar/Pulso, Impulso, CRM e Agendamento em um ciclo nomeado, mas **não conta como diferencial competitivo**.

---

## 2. Estrutura de home que converte para SaaS multi-produto

> Nota de rigor: o núcleo qualitativo abaixo é sólido e transfere bem para PME BR, porque descreve como a atenção humana funciona. Já os **percentuais precisos** da literatura de CRO são frágeis (muitos são conteúdo de marketing sem fonte primária, datados de 2010-2013, e todos EUA/global, nenhum de PME brasileira). Trate percentuais como direção, não como meta. O benchmark Unbounce (mediana SaaS 3,8%, top 10% ~11,45%) é real mas é de **landing pages de campanha com tráfego pago**, não de home: usar como ordem de grandeza, nunca como alvo do funil home-para-trial.

### 2.1 Princípios que sobrevivem (alta confiança)

1. **A home diz UMA coisa com clareza.** Multi-produto se comunica por divulgação progressiva, não por acúmulo. Não abrir com a lista Iza + Voz Nativa + Radar + Maestro + Echo + Impulso + CRM + Agendamento (fontes: https://genesysgrowth.com/blog/designing-b2b-saas-homepages ; https://www.vezadigital.com/post/best-saas-homepage-design-examples). Quanto menos sofisticado o comprador (PME BR), mais a clareza importa.
2. **Benefício/resultado no título vence funcionalidade.** Copy simples converte mais (direção sólida; os números de legibilidade de https://www.involve.me/blog/saas-landing-pages são ilustrativos, sem fonte primária).
3. **Um CTA primário por página.** Ofertas concorrentes derrubam conversão (princípio de attention ratio, Unbounce). CTA de resultado, nunca "Saiba mais" isolado (fonte: https://www.saashero.net/design/b2b-saas-landing-cta-practices/). **Não remover a navegação da home**: o conselho de "remover navegação dobra a conversão" vale para landing dedicada de campanha, não para home.
4. **Prova social específica com atribuição** (nome, cargo, empresa, número) vence prova genérica; distribuir ao longo da página. Todo número exibido tem que ser real e verificável (padrão de honestidade MACHIA).
5. **Formulário curto**, ~3 campos como alvo (não dogma), com perfil progressivo depois. Trial sem cartão: cadastro mínimo (e-mail + empresa/WhatsApp), enriquecer no onboarding, reforçar "sem cartão" junto ao botão.

### 2.2 Anatomia do hero de alta conversão (confiança média)

Título de resultado + subtítulo com diferencial + **1 CTA** + visual do **produto real** (não ilustração abstrata) + faixa de prova. **Sem carrossel** no hero (baixo clique, bem sustentado por NN/g). Ignorar prescrições arbitrárias de contagem de palavras. Manter proposta de valor e CTA acima da dobra, validando **sobretudo no mobile**, que domina o tráfego BR de PME (os estudos de eye-tracking em F e viés-esquerdo são de era desktop, 2006-2018, e se aplicam mal a mobile) (fontes: https://cxl.com/blog/10-useful-findings-about-how-people-view-websites/ ; https://www.saashero.net/design/b2b-saas-landing-cta-practices/).

### 2.3 Demo interativa ungated (maior aposta de conversão, a testar)

O movimento mais forte de 2025-2026. Relatório Navattic 2025 (base grande: 28 mil demos, 280 respondentes): ~70% do top 1% são ungated; ungated tem +10% de engajamento; top 1% chega a 84,4% de engajamento e 54% de CTR (fonte: https://www.navattic.com/report/state-of-the-interactive-product-demo-2025). Correções: as melhores demos são **curtas** (tender a menos passos; a maioria tem 10-19 passos, mas as top performam com menos), e **já existe a edição 2026** do relatório, checar antes de fixar benchmarks. Os casos de lift (dobrou leads, 6x conversão) são **autorreportados** por clientes de um fornecedor de software de demo, tratar como anedota promissora, não ganho garantido.

**Implicação:** tour interativo do produto real como **CTA secundário** no hero ("Ver a Iza trabalhando") e demo center ungated por caso de uso. Medir o efeito na própria home, não presumir o lift.

### 2.4 Sequência de seções recomendada (espinha convergente do mercado)

1. **Hero** outcome + CTA duplo (primário "Começar teste de 14 dias grátis" + secundário "Ver a Iza trabalhando") + microcopy de risco reverso (sem cartão, sem fidelidade, zero setup).
2. **Faixa de prova**: 1 número acima da dobra + 3 a 5 logos de clientes abaixo do hero (só logos reais/autorizados).
3. **Features por caso de uso** (não por lista de nomes): 3 a 4 jobs, ver 2.5.
4. **Agente Iza** ("contrate a Iza", terceira pessoa, verbos autônomos).
5. **Demo do produto** (tour ungated).
6. **Seção do loop de auto-correção auditada** (diferencial concreto, sem "único").
7. **Omnichannel** WhatsApp + Instagram, texto e áudio (Voz Nativa).
8. **Calculadora ROI** pública (números ilustrativos rotulados).
9. **Cases com números** (depoimento com nome, cargo, empresa, número real).
10. **Faixa de compliance** (apenas claims verificados por engenharia/jurídico).
11. **Teaser de preço** (Growth = mais popular, UM destaque só).
12. **Bloco de objeção/comparativo** (link para /comparativo e /migracao-zenvia).
13. **FAQ**.
14. **CTA de fechamento** + selo Founders 2026.

### 2.5 O ponto mais forte e mais seguro para multi-produto: organizar por job, não por nome

Estruturar em 3 a 4 jobs de negócio e encaixar os módulos dentro deles com bento grid ou abas:

| Job (caso de uso) | Módulos que entregam |
|---|---|
| **Atender 24/7** (texto e áudio) | Iza, Voz Nativa, Echo Copilot |
| **Vender e qualificar** | Iza, Maestro, Agendamento pela IA, CRM |
| **Fazer campanhas** | Impulso/Campanhas (add-on) |
| **Organizar e medir** | CRM integrado, Radar 360 / Pulso, loop de auto-correção auditada |

Este é o achado mais defensável do bloco de CRO para um produto multi-módulo.

---

## 3. Playbook de SEO técnico + conteúdo + GEO/AEO com keywords pt-BR priorizadas

> Base: o vocabulário verbatim do mercado foi observado ao vivo nas páginas dos concorrentes BR (fontes citadas na seção 5). As boas práticas de GEO/AEO abaixo são convenção estabelecida de otimização para respostas de IA e devem ser aplicadas com o ângulo ZappIQ, sem clonar as headlines dos concorrentes.

### 3.1 SEO técnico (fundação)

- **Performance e mobile-first**: sub-3s, Core Web Vitals verdes, evitar vídeo pesado no hero. O tráfego BR de PME é majoritariamente mobile; validar tudo no mobile primeiro.
- **Landings dedicadas** além da home, uma por caso de uso/ICP e uma por concorrente (páginas de migração convertem mais que jogar tráfego na home). A ZappIQ já tem /comparativo e /migracao-zenvia; expandir para /migracao-blip, /migracao-poli, e por segmento (clínicas, e-commerce, serviços).
- **Metadata correta**: corrigir já a `description` de /precos (divergência C: cita Starter e R$ 197 descontinuados). Metadata errada canibaliza a percepção de preço no snippet do Google.
- **Dados estruturados (Schema.org)**: `SoftwareApplication`/`Product` com `offers` (Lite, Growth, Scale), `FAQPage` no FAQ de billing, `Organization` com o selo MACHIA, `BreadcrumbList`. Schema é o que alimenta rich snippets e a extração por LLMs.
- **Sitemap + hreflang pt-BR**, canonical limpo, sem parâmetros de campanha indexados.

### 3.2 Conteúdo (capturar o vocabulário do comprador)

Cobrir o vocabulário verbatim que o mercado já usa, sempre com o ângulo ZappIQ. Vocabulário observado nas páginas de Zenvia, Poli, RD, Kommo, GPT Maker, Huggy (fontes na seção 5):

**Keywords pt-BR priorizadas (fundo e meio de funil primeiro):**

| Prioridade | Keyword / termo de busca | Intenção | Ângulo ZappIQ na página |
|---|---|---|---|
| P0 | "chatbot com IA para WhatsApp" | comercial | Agente autônomo, não chatbot; API oficial |
| P0 | "atendimento automatizado WhatsApp" | comercial | Atende, qualifica e vende 24/7, texto e áudio |
| P0 | "CRM no WhatsApp" / "CRM integrado WhatsApp" | comercial | CRM nativo, sem integração frágil |
| P0 | "quanto custa [Blip / Zenvia / Poli]" | comparativo | Páginas /comparativo e /migracao-* com custo total transparente |
| P0 | "WhatsApp API oficial preço" | comercial | Mensalidade fixa, zero setup, sem cobrança por conversa |
| P1 | "disparo em massa WhatsApp" / "envio em massa" | comercial | Impulso/Campanhas, API oficial (sem risco de bloqueio) |
| P1 | "um número vários atendentes WhatsApp" | informacional/comercial | Multiatendimento incluído, sem preço por assento em dólar |
| P1 | "agente de IA para vendas" | comercial | Iza vende e agenda de ponta a ponta |
| P1 | "qualificar leads com IA WhatsApp" | comercial | Maestro + Iza qualificam e passam ao CRM |
| P1 | "atendimento 24/7 WhatsApp" | comercial | Operação sempre no ar, com auto-correção auditada |
| P2 | "transcrição de áudio WhatsApp atendimento" | informacional | Voz Nativa: entende e responde em áudio |
| P2 | "sugestão de resposta atendente IA" | informacional | Echo Copilot |
| P2 | "funil de vendas WhatsApp" | informacional | CRM + pipeline |
| P2 | "LGPD atendimento WhatsApp / dados no Brasil" | confiança | Faixa de compliance (só claims verificados) |
| P2 | "migrar de [Zenvia/Blip/Poli]" | comparativo | Páginas de migração dedicadas |

Regra: não clonar as manchetes dos concorrentes; usar o termo deles como âncora de SEO e virar o ângulo para as bandeiras ZappIQ.

### 3.3 GEO/AEO (otimização para motores generativos e answer engines)

O comprador BR já pergunta a LLMs "qual a melhor plataforma de IA para WhatsApp" e "quanto custa a Zenvia". Para a ZappIQ ser citada nessas respostas:

- **Blocos de resposta direta**: cada página deve responder a pergunta explícita em 2 a 3 frases no topo da seção (formato pergunta-resposta), que é o que os LLMs extraem e citam.
- **Tabelas comparativas factuais e citáveis**: preço, setup, modelo de cobrança, fidelidade. Números precisos e datados são mais citados por LLMs do que adjetivos. **Substanciar antes de publicar** (CDC/CONAR para comparativo nominal, ver seção 5).
- **FAQPage com schema** cobrindo as perguntas de billing e de fit; é a estrutura que answer engines preferem.
- **Entidade clara**: reforçar "ZappIQ, uma empresa MACHIA (MACHIA Tecnologia Disruptiva Ltda)" com dados consistentes em site, schema e diretórios, para o grafo de conhecimento associar a entidade à categoria "plataforma agêntica de atendimento e vendas no WhatsApp".
- **Conteúdo com autoria e data**: posts do blog assinados, com data e metodologia aberta (casa com a moldura "ilustrativo" das métricas beta), aumentam a probabilidade de citação por IA e a confiança do leitor.
- **Presença em fontes que os LLMs leem**: perfis consistentes em diretórios de software e menções em conteúdo editorial pt-BR sobre IA para PME.

---

## 4. Boas práticas de página de preços

> Núcleo estrutural sólido; percentuais de blogs de pricing (ex.: https://growigami.com/blog/saas-pricing-page-best-practices) são heurísticos e ilustrativos, não fatos. Os padrões de layout foram corroborados em fontes primárias (Intercom, HubSpot, Notion).

### 4.1 Estrutura de tiers

- **Três tiers de venda + Enterprise âncora**, com o tier do meio como alvo. A escada da ZappIQ já é essa: Lite R$ 247 → Growth R$ 497 (2x) → Scale R$ 1.497 (3x) → Enterprise (~R$ 9.900 como âncora interna). Growth como o único destaque.
- **Só UM plano destacado** (corrigir divergência A: hoje Lite e Growth têm ambos `highlight: true`). Destacar dois anula a âncora. Notion destaca só o Business (fonte: https://www.hubspot.com/pricing/marketing e https://www.intercom.com/pricing como referências de página de preço madura).
- **Preços visíveis** convertem melhor do que "fale com vendas" para self-serve de ACV baixo. Enterprise pode exibir "a partir de R$ 9.900/mês" para reduzir atrito, mas expor o número é **decisão comercial do Rodrigo** (divergência D), não regra de UX.

### 4.2 Toggle mensal/anual

- Exibir **sempre a economia em % E em R$**, com o mensal riscado como âncora. Growth anual: 20% off = R$ 397,60/mês, economia de **R$ 1.192,80/ano** (cálculo conferido).
- Hoje o default é Mensal (`Pricing.tsx` L31 `useState(false)`). **Pré-selecionar Anual é teste A/B, não troca às cegas**: para PME BR, pré-selecionar o compromisso mais caro gera atrito e beira dark pattern (risco CDC).

### 4.3 Núcleo incluído + add-ons em seção separada (padrão robusto)

- Bloco **"Incluído em todos os planos"** declarado ANTES dos add-ons: Iza, CRM, Maestro, Analytics operacional e loop de auto-correção auditada (Qualidade da IA). Atenção de fato: Echo Copilot e Agendamento pela IA entram do Growth para cima (no Lite o `echoCopilot` é `false` e o Agendamento é add-on de R$ 49), então NÃO listar os dois como incluídos em todos os planos. HubSpot lista os Core Seats antes dos créditos; Notion embute IA e cobra só o excedente (fontes: https://www.hubspot.com/pricing/marketing ; https://www.intercom.com/pricing).
- Faixa **"Amplie a plataforma"** com cards padronizados de add-on (franquia inclusa + "Saiba mais"). A ZappIQ tem muitos módulos: Voz Nativa (6 pacotes, R$ 79,90 a R$ 929,90), Radar 360 (R$ 397), WhatsApp Business número extra (R$ 137/mês), Instagram Direct extra (R$ 97), atendente (seat) extra (R$ 79), pacotes de mensagens de IA (R$ 99 a R$ 749), contatos extras (+5k R$ 59 / +25k R$ 199), Agendamento pela IA (R$ 49, incluído do Growth para cima) e Zap Impulso (Start R$ 197 / Pro R$ 597 / Scale R$ 1.297).
- **Refletir disponibilidade real**: a Voz está removida do seletor até Q3/2026 (comentário em `Pricing.tsx`), então exibir como add-on com link /voz, não como toggle ativo. Hoje o `Pricing.tsx` só renderiza o Radar (R$ 397), então o cliente não vê preço errado; consolidar o catálogo de add-ons é dívida interna, não bug de UI visível.

### 4.4 Bandeiras de preço como arma (com ressalva de honestidade)

Faixa de bandeiras junto aos CTAs: **zero setup fee, mensalidade fixa, 14 dias sem cartão sem fidelidade, dados no Brasil/LGPD**.

- **Ressalva crítica de honestidade**: "mensalidade fixa, sem cobrança por conversa" é verdadeiro **dentro da cota**. Há overage (AI_MSG_OVERAGE ~R$ 0,03/msg no `planConfig`) e passthrough Meta nos disparos. A copy não pode sugerir custo marginal zero. Formulação honesta: "sem cobrança por conversa de atendimento na sua franquia; excedente e disparos têm custo transparente".
- Exibir "Meta Business Partner" como bandeira de parceria oficial com a Meta.

### 4.5 FAQ de billing (8 a 12 perguntas, foco ZappIQ)

Fim do trial, troca de plano com proration, "vocês cobram por conversa?" (não na franquia, sim no excedente), taxa de setup (não), implementação assistida (consultoria MACHIA opcional, nunca taxa de plataforma), add-ons e excedentes, cancelamento sem fidelidade, onde ficam os dados (Brasil, LGPD, DPA em 2 cliques).

### 4.6 Tabela de comparação + mobile

- Tabela abaixo dos cards, agrupada (Núcleo agêntico, IA, Canais Meta, CRM, Governança/LGPD, Suporte/SLA), com tooltips e expander "Ver todos os recursos". Bullets de limite reescritos como benefício + número.
- Mobile: empilhar tiers com Growth em primeiro (coerente com destaque único), CTAs com alvo de toque grande, tabela com scroll horizontal.

### 4.7 Escassez legítima

Usar a oferta real da página /founders como selo perto do Growth (Cohort Founders 2026, 50 vagas, 30% vitalício). Contador **real**, nunca countdown falso. Confirmar os termos exatos na página, sem inflar a promessa.

---

## 5. Brechas dos concorrentes BR e como atacar

> Teardown de 9 concorrentes; preços de Zenvia, Poli, Zaia, RD, GPT Maker e Kommo verificados ao vivo em julho/2026. O padrão central: todos já dizem "agentes de IA" e quase todos escondem três custos que o cliente odeia (setup, cobrança por conversa/crédito, fidelidade). A ZappIQ ataca com as três bandeiras que **nenhum concorrente oferece junto**: zero setup, mensalidade fixa sem cobrança por conversa, trial 14 dias sem cartão sem fidelidade.

### 5.1 Mapa de custos escondidos (munição para /comparativo)

| Concorrente | Setup | Modelo de cobrança | Fidelidade | Brecha para atacar |
|---|---|---|---|---|
| **ZappIQ** | **R$ 0** | **Mensalidade fixa (excedente e disparos à parte)** | **Sem fidelidade** | (referência) |
| **Poli Digital** | R$ 1.197,90 (hoje com promo 50% OFF) | Mensal (Inicial R$ 829,90 / Expansão R$ 1.319,90 / Ilimitado R$ 1.859,90) + R$ 0,89/crédito por mensagem | 12 meses | Mesma promessa "da captação à venda", mas com setup, crédito por mensagem e contrato. Fonte: https://poli.digital/planos/ |
| **Zenvia** | Taxa de **primeiro mês** R$ 649 (Starter a Expert, ao habilitar WhatsApp/RCS) e R$ 3.999 (Professional) | Specialist R$ 600 / Expert R$ 1.800 / Professional R$ 3.900 + por "Interactionz" (crédito de janela 24h) | Varia | Por conversa + taxa inicial. **NÃO citar "setup R$ 1.999 no Expert", não existe.** Fonte: https://zenvia.com/precos/ |
| **RD Conversas** | (não publicado) | Por atendimento único/mês: Basic R$ 989 (500) / Pro R$ 2.699 (3.000) / Advanced sob consulta, cobrado anual | Anual | Pune o sucesso: quanto mais atende, mais paga. "Atenda à vontade, mensalidade fixa." Fonte: https://www.rdstation.com/produtos/conversas/ |
| **Kommo** | (não publicado) | Por assento em USD: US$ 15 / 25 / 45 por usuário/mês | 6 a 24 meses | Preço em dólar + compromisso de 6 meses. "Preço em real, previsível, sem assento em dólar." Fonte: https://www.kommo.com/br/ |
| **GPT Maker** | (não publicado) | Por crédito de mensagem: Basic R$ 87 (2.500) / Standard R$ 397 (11.500) / Corporate R$ 997 (30.000), consumo varia por LLM | 7 dias grátis | "Seus créditos acabam no meio do mês." Sem Meta oficial. Fonte: https://gptmaker.ai/ |
| **Blip/Take** | (não publicado) | Enterprise, foco em grandes contas | (demo) | Deixa o vale de PME (R$ 400-800) aberto; só revela preço após reuniões. Não citar volumes de marketing não verificados. Fonte: https://www.blip.ai/ |
| **Letalk** | Sob consulta (não publicado; "~R$ 1.500" é inferência de mercado, **não publicar como fato**) | Sem preço público, "operação acompanhada" | (demo) | Trava preço atrás de demo; posicionar "a plataforma opera sozinha, a consultoria MACHIA é bônus, não pedágio". Fonte: https://letalk.com.br/ |
| **Huggy** | (não publicado) | Base + por usuário (o "~R$ 69,90/usuário" é inferência, **não publicar como fato**) | (não publicado) | Framing de 3 camadas (Automática/Inteligente/Humana) é didático; "ZappIQ não amarra preço ao número de atendentes". Fonte: https://www.huggy.io/ |

### 5.2 A ameaça de posicionamento mais séria: Zaia

A Zaia já cravou **"Agentic OS"**, Vibe Agent (text-to-agent), Squad Builder, +60 MCPs, BYOK, 7 dias grátis sem cartão, Enterprise "a partir de R$ 5.000/mês, assinatura anual" (fonte: https://zaia.app). Ponto verificado e decisivo: **a Zaia NÃO reivindica parceria oficial Meta**, são integrações, não parceria oficial com a Meta.

**Como atacar:** a ZappIQ não pode reivindicar "agêntico" como inédito. Diferenciar por posicionamento: **Zaia é horizontal, para dev, monta-você** (BYOK, MCPs, sem Meta oficial, Enterprise anual caro); **ZappIQ é agêntica para PME, com Meta parceiro oficial, dados no Brasil, mensalidade fixa em real, implementação assistida inclusa e loop de auto-correção com humano aprova**. Posicionar Zaia como ferramenta, ZappIQ como operação pronta.

### 5.3 Correções factuais obrigatórias antes de publicar comparativo

- **Não** afirmar "setup Zenvia R$ 1.999" (não existe; é taxa de primeiro mês R$ 649 a R$ 3.999).
- Citar o setup da Poli **com a promo vigente** ("R$ 1.197,90, hoje com 50% OFF na implantação"), não como valor fixo.
- **Não** afirmar que Zenvia e Poli "travam tudo atrás de demo": Zenvia tem tier gratuito (Starter R$ 0) e Poli anuncia "Teste Grátis". O diferencial de self-serve sem cartão é mais forte contra **Blip e Letalk** (sem preço público). Contra Zenvia e Poli, o diferencial é **sem setup e sem cobrança por conversa**.
- **Não** publicar valores inferidos de Letalk (~R$ 1.500) e Huggy (~R$ 69,90/usuário) como fato; usar "sem preço público, setup sob consulta".
- Comparativo nominal precisa ser **substanciável (CDC/CONAR)**, com preços atuais re-verificados ao vivo e o exemplo numérico considerando o passthrough Meta dos disparos ZappIQ.

### 5.4 Frentes de ataque estruturais

- **LGPD como marketing de PME**: DPA, DPO direto (dpo@zappiq.com.br), exclusão de titular, incidentes em 72h, isolamento por cliente, "dados do cliente não treinam modelos". Espaço vago entre os concorrentes. Publicar **somente** o que engenharia/jurídico confirmarem.
- **Observabilidade executiva (Radar/Pulso) + auto-correção auditada** como categoria própria, já que "agente de IA" virou commodity e só a Zaia chega perto. Provar com números reais medidos antes de publicar.
- **Implementação assistida = consultoria MACHIA opcional**, nunca taxa de plataforma, contraponto direto ao setup fee (Poli, Zenvia) e à "operação acompanhada" da Letalk.

---

## 6. Top 15 recomendações acionáveis priorizadas (impacto x esforço)

Legenda: Impacto (Alto/Médio) x Esforço (Baixo/Médio/Alto). Ordem = maior impacto e menor esforço primeiro (quick wins no topo).

| # | Recomendação | Impacto | Esforço | Por quê / fonte |
|---|---|---|---|---|
| 1 | **Corrigir o destaque duplo de plano**: deixar `highlight: true` só no Growth (hoje Lite L89 e Growth L198 estão ambos ativos, `Pricing.tsx` L121/L150). | Alto | Baixo | Bug real que anula a âncora de preço. Divergência A. |
| 2 | **Corrigir a metadata de /precos**: remover "Starter" e "R$ 197" (descontinuados), usar Lite/Growth/Scale/Enterprise e "a partir de R$ 247/mês, zero setup, 14 dias grátis". | Alto | Baixo | Snippet do Google mostra preço errado. Divergência C (`page.tsx` L8/L12). |
| 3 | **Casar trial com enforcement**: definir `trialDays` no Growth (hoje indefinido, mas o CTA promete 14 dias). | Médio | Baixo | Copy sem enforcement gera atrito no signup. Divergência B. |
| 4 | **Reescrever o hero** para promessa de desfecho com categoria agêntica embutida (ex.: "A plataforma agêntica que atende, vende e faz campanha pela sua operação"), banir "chatbot" e "conversacional". Números de prova SEMPRE rotulados como ilustrativos. | Alto | Baixo | Padrão outcome-first dos líderes. Fontes: gorgias.com, crescendo.ai, intercom.com/fin. |
| 5 | **CTA único e coerente**: um primário global ("Começar teste de 14 dias grátis") repetido + secundário "Ver a Iza trabalhando". Nunca "Saiba mais" isolado. Simplificar a navegação, sem removê-la. | Alto | Baixo | Attention ratio. Fonte: saashero.net, involve.me. |
| 6 | **Faixa de bandeiras junto aos CTAs**: zero setup, mensalidade fixa sem cobrança por conversa (dentro da franquia), 14 dias sem cartão sem fidelidade. Ressalva de honestidade: overage e passthrough Meta existem. | Alto | Baixo | Nenhum concorrente BR oferece as três juntas. Seção 5. |
| 7 | **Elevar a Iza ao frame "contrate a Iza"**: terceira pessoa, verbos de ação autônoma (atende, qualifica, vende, agenda, dispara, atualiza o CRM). | Alto | Médio | Frame Fin/Artisan. Fontes: intercom.com/fin, artisan.co. |
| 8 | **Reorganizar features por job, não por lista de nomes**: Atender 24/7, Vender e qualificar, Fazer campanhas, Organizar e medir (bento grid/abas). | Alto | Médio | Achado mais seguro para multi-produto. Fontes: genesysgrowth.com, vezadigital.com. |
| 9 | **Seção própria para o loop de auto-correção auditada** (detecta, score, sugere, humano aprova, aprende ~3 min). REMOVER a alegação de "único". | Alto | Médio | Capacidade-estrela de todo líder. Fontes: zendesk.com.br, crescendo.ai. |
| 10 | **Bloco de custo total transparente** (setup / cobrança por conversa / fidelidade) comparando ZappIQ com Poli, Zenvia, RD, GPT Maker, Kommo. Com correções factuais da seção 5.3 e substanciação CDC/CONAR. | Alto | Médio | Ataca a brecha central do mercado BR. Seção 5.1. |
| 11 | **Faixa de prova + logos**: 1 número acima da dobra + 3 a 5 logos reais. Todo número real e verificável antes de publicar. | Alto | Médio | Padrão Fin/Gorgias. Fontes: intercom.com/fin, gorgias.com. |
| 12 | **Página de preços completa**: núcleo incluído antes dos add-ons, faixa "Amplie a plataforma" em cards, toggle com economia em % e R$, tabela agrupada, FAQ de billing. | Alto | Médio | Padrão Intercom/HubSpot. Fontes: intercom.com/pricing, hubspot.com/pricing. |
| 13 | **Demo interativa ungated** ("Ver a Iza trabalhando") como CTA secundário + demo center por caso de uso. Medir o lift na própria home. | Alto | Alto | Maior aposta de conversão 2025-2026. Fonte: navattic.com (checar edição 2026). |
| 14 | **Playbook de SEO/GEO/AEO**: schema (SoftwareApplication, FAQPage), landings de migração por concorrente, keywords pt-BR da seção 3.2, blocos pergunta-resposta citáveis. | Alto | Alto | Captura o vocabulário do comprador e as respostas de IA. Fontes: seção 5 (páginas dos concorrentes). |
| 15 | **Faixa de compliance/LGPD** (DPA 2 cliques, DPO, exclusão de titular, incidentes 72h, dados no Brasil/SP, SLA 99,9% com créditos no Scale+, dados não treinam modelos). Publicar SÓ o que engenharia/jurídico confirmarem. | Médio | Alto | Espaço vago no mercado BR; risco jurídico se não substanciado. Seção 5.4. |

### Sequência sugerida de execução

- **Sprint 1 (quick wins de código e copy, esforço baixo):** itens 1, 2, 3, 4, 5, 6. Corrigem bugs reais e reposicionam o topo da página com pouco esforço.
- **Sprint 2 (reestruturação da narrativa):** itens 7, 8, 9, 11, 12.
- **Sprint 3 (diferenciação e captura de demanda):** itens 10, 13, 14, 15.

---

## Guardrails finais (não violar)

1. **Copy**: pt-BR com acentuação completa, sem travessão. Voz MACHIA piloto-instrutor: tranquilo, técnico, decisivo, prova antes de promessa. Nunca "transformação digital", "solução inovadora", "ferramenta poderosa", "revolução da IA".
2. **Números beta** (Iza ~65%, +30%, payback 90 dias) sempre rotulados como ilustrativos, com a moldura de `blogData.ts`. Nunca como métrica de caso auditado.
3. **Claims de fato com risco jurídico** (Meta Business Partner, dados no Brasil, SLA 99,9%, incidentes 72h, comparativos nominais) só ao ar após confirmação de engenharia/jurídico e substanciação CDC/CONAR.
4. **"Único"/"exclusivo"** fora da copy do loop auditado: insustentável.
5. **"Agêntico" é higiene de categoria, não moat**: a Zaia e o Zendesk BR já ocupam o termo. O diferencial defensável é a combinação (agêntico + auditado + humano aprova + amplitude multi-produto no ticket de PME + zero setup + mensalidade fixa + dados no Brasil), não a categoria isolada.
6. **Mensalidade fixa** é verdade dentro da franquia: a copy não pode sugerir custo marginal zero (há overage ~R$ 0,03/msg e passthrough Meta nos disparos).
