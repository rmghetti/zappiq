# Estratégia de reposicionamento da ZappIQ

**Autor:** Estrategista de posicionamento (método April Dunford, "Obviously Awesome")
**Data:** 10/07/2026
**Base de evidência:** inventário de produto, comercial e técnico do monorepo `~/zappiq-main` (código real de julho/2026), auditoria da landing atual e do site live `zappiq.com.br`, e o brief de melhores práticas (`00-pesquisa-melhores-praticas.md`).
**Objetivo:** mover a ZappIQ de "plataforma de IA conversacional para os canais Meta" para uma categoria que torne óbvio o que o produto já é: uma operação de atendimento, vendas e campanhas que roda sozinha, com CRM que se preenche na origem e você aprovando.

## Como ler este documento

- O método é o de April Dunford: posicionamento não é slogan, é escolher o **contexto de mercado** (a categoria) em que os atributos únicos do produto viram valor óbvio. A categoria errada esconde o produto. A certa o revela.
- Toda capacidade citada está ancorada em código verificado. O status honesto (em produção, parcial, em construção) vem junto, porque a voz MACHIA é prova antes de promessa.
- Números próprios (Iza resolve cerca de 65 por cento, conversão mais 30 por cento, payback mínimo de 90 dias) são **ilustrativos, base beta**, e só entram no ar com a mesma moldura de disclaimer que já existe no `blogData.ts`.
- Claims de fato com risco jurídico (Meta Business Partner, dados no Brasil, SLA 99,9 por cento, incidente em 72h, "dados não treinam modelos", comparativo nominal) só publicam depois de confirmação de engenharia e jurídico.
- Regra de copy: português do Brasil com acentuação completa, sem travessão. Vírgula, dois-pontos ou ponto no lugar.

---

## 1. Diagnóstico: o gap entre o que o site diz e o que o produto é

### 1.1 O posicionamento atual e a armadilha de categoria

O site hoje se apresenta assim (hero verbatim, verificado no live e no código):

> "Atenda no WhatsApp e Instagram 24 horas por dia. Sem contratar mais ninguém."

A categoria implícita é **atendimento conversacional com IA no WhatsApp**. O verbo do topo é "atender". Os oito motivos da home são atributos e preço (multicanal, modelos de classe mundial, LGPD, setup zero, dados no Brasil, preço fixo, voz), não os produtos. CRM, Campanhas, Agendamento e o copiloto do atendente não têm seção própria: aparecem só como bullet de plano, item de menu quebrado (a âncora `#produtos` não existe na página, o componente `Products.tsx` é código morto) ou de raspão.

O efeito, na cabeça do comprador, é uma **armadilha de categoria**. Ao dizer "IA conversacional para WhatsApp", a ZappIQ se coloca ao lado de Blip, Zenvia, Huggy, Poli e chatbots. E nessa prateleira o comprador compara pelo eixo em que esses concorrentes competem: preço por conversa e feature de chatbot. Os atributos que a ZappIQ tem e eles não têm (CRM que se preenche sozinho, atribuição de receita à IA, loop de auto-correção auditada, campanhas montadas por IA, agendamento executado por tools) ficam **invisíveis**, porque a categoria "chatbot" não pede nada disso. O produto está competindo para baixo.

### 1.2 A realidade do produto (o que o código prova)

O inventário técnico mostra um produto de escopo muito maior, com o núcleo já em produção:

- **CRM que se preenche sozinho** (`crmAutomationService.ts`): a cada turno a IA atualiza leadStatus, estágio de funil, leadScore de 0 a 100 e timeline. Dado limpo capturado na origem, sem digitação do vendedor.
- **Vendas atribuídas à IA** (`dealAttribution.ts`): AI Influence Score liga a conversa ao deal fechado e mede quanto da receita passou pela Iza.
- **Maestro** (`agents/flow*.ts`): a IA constrói o fluxo inteiro a partir do onboarding, o canvas mostra, o cliente aprova e versiona. Núcleo determinístico mais nó-IA agêntico (com guarda anti-SSRF) em produção.
- **Impulso** (`impulso*.ts`): objetivo em linguagem natural vira campanha completa (segmento, canais, copy na voz da marca, verba, estimativa), disparo real e coach determinístico, em soft launch como add-on.
- **Agendamento pela IA** (`appointments.ts`, `googleCalendar.ts`): a IA marca, remarca e cancela na conversa, com agenda interna mais sync Google Calendar, sem alucinar horário.
- **Loop de auto-correção auditada** (`agentEvalRunner.ts`, `agentPromptPatcher.ts`): roda cenários golden, juiz determinístico mais LLM, sugere patch cirúrgico no prompt, humano aprova, a plataforma aplica e re-verifica. Trilha de auditoria fechada.
- **Pulso** (`analyticsPulse.ts`): observabilidade que a IA narra em português de dono, sobre fatos já computados, com fallback determinístico. Cron ligado em produção.
- **Governança LGPD no núcleo**: audit log com cadeia de hash SHA-256, DSR self-service, RLS multi-tenant, dados processados e armazenados no Brasil, em São Paulo, com infraestrutura no Brasil (São Paulo).

Isto não é um chatbot com CRM acoplado. É uma plataforma agêntica que opera a operação de atendimento e vendas do cliente de ponta a ponta.

### 1.3 O gap em uma frase

**A ZappIQ está vendida como o produto que ela era, num mercado em que o produto que ela é não tem concorrente direto no ticket de PME.** O site fala "atende"; o código faz "atende, vende, faz campanha, organiza o CRM, agenda e se audita sozinho". A tabela abaixo mostra a distância.

| O que o site comunica hoje | O que o produto já é (código) |
|---|---|
| Atendimento conversacional 24/7 | Operação de atendimento **e vendas e campanhas** autônoma |
| Um chatbot com nome (Iza) | Um agente que qualifica, cria follow-up e tem a receita atribuída a ele |
| CRM como bullet de plano | CRM que se preenche sozinho a cada turno da conversa |
| Fluxos "em breve" (Maestro) | A IA constrói o fluxo, você aprova e versiona (em produção) |
| Campanhas invisíveis | Objetivo em linguagem natural vira campanha (Impulso, add-on live) |
| Agendamento só no verbo do hero | Agendamento executado por tools mais Google Calendar |
| "Modelos de classe mundial" | Loop de auto-correção auditada que corrige e comprova em minutos |
| Analytics como card | Pulso: a operação narrada todo dia, sobre fatos, com ação sugerida |

### 1.4 Por que o gap custa dinheiro

Em termos de Dunford: o posicionamento define qual é a **alternativa competitiva** na cabeça do comprador. Hoje a alternativa é "outro chatbot de WhatsApp", e nessa comparação o comprador pergunta "quanto custa por conversa" e "qual é mais barato". A ZappIQ ganha essa briga (mensalidade fixa, zero setup), mas ganha a briga errada: vende barato um produto que substitui uma colcha de retalhos inteira (chatbot mais CRM mais ferramenta de campanha mais agenda mais BI) e o headcount de atendimento. O reposicionamento corrige a alternativa competitiva: de "outro bot" para "montar e manter essa operação na mão, com gente e cinco ferramentas soltas".

### 1.5 Divergências a corrigir antes de publicar (higiene, não estratégia)

O reposicionamento pressupõe uma base limpa. Estas divergências entre código, site e a tabela de marca de junho já estão confirmadas e precisam ser sanadas antes de qualquer publicação. Os quatro planos ativos batem (Lite R$ 247, Growth R$ 497, Scale R$ 1.497, Enterprise sob consulta). O problema é copy stale e código inconsistente.

| Achado | Onde | Ação |
|---|---|---|
| Dois planos com selo "Mais Popular" (`highlight:true` em Lite e Growth) | `planConfig.ts` L89/L198, `Pricing.tsx` L121 | Deixar destaque só no Growth |
| `trialDays` indefinido no Growth, mas o CTA promete 14 dias | `planConfig.ts` | Definir `trialDays` no Growth |
| Metadata de /precos cita "Starter" e "a partir de R$ 197" (descontinuados) | `app/precos/page.tsx` L8/L12 | Trocar por Lite a Enterprise, "a partir de R$ 247, zero setup, 14 dias grátis" |
| /observabilidade com tabela de preço fantasma (Starter 297 / Growth 597 / Scale 997 / Enterprise 2997) | página /observabilidade | Alinhar ao `planConfig.ts` |
| Plano "Business" (legado) citado para SLA 99,9 por cento na home e /precos | `Pricing.tsx`, /sla, /enterprise | Trocar por Scale (é onde o SLA contratual começa) |
| Impulso repreçado: Pro R$ 597 / Scale R$ 1.297 (spec antigo dizia 497/997) | usar o número do código | Atualizar toda menção comercial |
| Razão social "ONZE E ONZE" em 4 arquivos do site | LandingFooter, /lgpd, /legal, /roadmap | Trocar por MACHIA Tecnologia Disruptiva Ltda (mesmo CNPJ) |
| `Products.tsx` órfão, mega-menu apontando para âncora `#produtos` inexistente | Navbar, LandingPage | Criar páginas de produto reais (ver seção 5) e religar o menu |
| JSON-LD com aggregateRating fabricado (4,8 / 500) e ofertas defasadas (297 a 997) | `layout.tsx`, `schemaSoftware` | Remover rating fabricado, corrigir ofertas para 247 a 1497 |
| Sitemap com slugs de segmento errados (ecommerce/servicos/educação) gerando 404 | `sitemap.ts` | Corrigir para varejo/saude/servicos-b2b/educacao |
| /roadmap público obsoleto (não lista Impulso, Agendamento, Pulso, auto-correção) | /roadmap | Reescrever |
| Travessão em massa e "pulse ai" fora de marca | vários componentes e metadata | Passar tudo pela regra de copy e trocar por Iza/Radar/Pulso |

---

## 2. Nova categoria e promessa central

### 2.1 As alternativas competitivas (o que o PME faz sem a ZappIQ)

Antes de escolher a categoria, é preciso saber contra o que a ZappIQ realmente compete. Um dono de PME que não usa a ZappIQ faz uma destas três coisas:

1. **Contrata gente** para atender WhatsApp e Instagram (headcount, folha, turnover, sem 24/7).
2. **Monta uma colcha de retalhos**: um chatbot (Blip, Zenvia, Poli) mais um CRM à parte (RD, HubSpot, Kommo) mais uma ferramenta de disparo mais uma agenda mais um BI, tudo integrado na marra e nenhum falando com o outro.
3. **Faz na mão**, no WhatsApp comum, e perde lead à noite e no fim de semana.

Nenhuma dessas alternativas é "outro agente agêntico". O concorrente real é o **trabalho manual e a colcha de retalhos**. A categoria precisa deixar isso óbvio.

### 2.2 Os atributos únicos (verificados em código)

Estes atributos, tomados em conjunto e no ticket de PME (R$ 247 a R$ 1.497), não têm par no mercado brasileiro verificado:

- CRM que se preenche sozinho, na origem da conversa.
- Atribuição de receita à IA (deal ligado à conversa).
- A IA que constrói o fluxo (Maestro), não só o executa.
- Campanha montada a partir de um objetivo em linguagem natural (Impulso).
- Agendamento executado por tools com Google Calendar.
- Loop de auto-correção auditada com humano no comando.
- Observabilidade narrada (Pulso) sobre fatos determinísticos.
- Tudo com zero setup, mensalidade fixa, trial sem cartão, dados no Brasil e LGPD no núcleo.

O valor que esse conjunto entrega tem quatro temas: **amplitude** (a operação inteira num lugar), **autonomia com aprovação** (roda sozinha, você aprova), **prova de resultado** (CRM que enche, atribuição, Pulso, ROI) e **confiança auditável** (auto-correção, observabilidade, LGPD).

### 2.3 Opções de categoria (prós e contras)

| Opção de categoria | O que enquadra | Prós | Contras |
|---|---|---|---|
| **A. Plataforma agêntica de atendimento** | atendimento com IA autônoma | Higiene de categoria alinhada ao mercado global; fácil de entender | "Atendimento" subvende vendas, campanhas e CRM; Zendesk e Zaia já ocupam "agêntico"; mantém a armadilha atual |
| **B. Funcionária digital (contrate a Iza)** | a Iza como colega que atende, vende, agenda, faz campanha | Personificação forte, emocional, frame Fin/Artisan/Salesforce "digital labor"; PME entende "não preciso contratar"; a Iza já é nomeada | "Uma funcionária" pode subvender a plataforma inteira e a observabilidade; risco de soar como "só um bot com nome bonito" |
| **C. Sistema operacional do WhatsApp (Agentic Ops OS)** | a camada que opera tudo | Amplitude máxima; frame Sierra "Agent OS" | "OS" é abstrato demais para o dono de PME leigo; Zaia já cravou "Agentic OS"; frio, distante da dor |
| **D (recomendada). Operação de atendimento e vendas autônoma no WhatsApp e Instagram** | atendimento + vendas + campanhas + CRM + agenda + observabilidade, rodando sozinha, você aprovando | Enquadra a amplitude e a autonomia (os dois temas de valor mais únicos); a alternativa competitiva vira "fazer na mão e com cinco ferramentas", não "outro bot"; personificável pela Iza; outcome-first, casa com a voz MACHIA | Categoria mais larga exige narrativa de ponta a ponta bem contada (seção 4) para não virar lista; precisa de prova por pilar para não soar como promessa vazia |

### 2.4 Categoria recomendada e promessa central

**Categoria recomendada: D, expressa para o PME como "sua operação de atendimento e vendas rodando sozinha, no WhatsApp e no Instagram, com você aprovando".**

A ZappIQ deve **liderar uma subcategoria própria**, no espírito de Dunford: quando você é o mais completo e ninguém ocupa exatamente o seu terreno, você nomeia o terreno. O nome de trabalho da subcategoria é **Operação Autônoma de Atendimento e Vendas**. A Iza é o rosto dessa operação (frame "contrate a Iza"), o que resolve o ponto fraco da opção B: a Iza não é "um bot com nome", é a operação inteira personificada. E "agêntica" entra como qualificador técnico no corpo, nunca como o moat, porque Zaia e Zendesk já usam o termo.

**Mensagem-mãe recomendada:**

> **A Iza atende, vende e faz campanha pela sua operação, no WhatsApp e no Instagram. Você aprova, ela executa, o resultado aparece no painel.**

Racional: a mãe carrega o desfecho (atende, vende, faz campanha), a autonomia com controle (você aprova, ela executa) e a prova (o resultado aparece no painel, gancho para Pulso, CRM e atribuição). É outcome-first como Gorgias e Crescendo, personificada como Fin e Artisan, e termina em prova, não em adjetivo.

**Variações por contexto** (mesma mãe, ângulos diferentes):

- **Hero da home:** "A Iza atende, vende e faz campanha pela sua operação. Você aprova, ela executa."
- **Contra headcount:** "Sua operação de atendimento e vendas no ar 24 horas, sem contratar mais ninguém."
- **Contra a colcha de retalhos:** "Atendimento, vendas, campanha e CRM num lugar só. A Iza opera, você aprova."
- **Investidor / enterprise:** "A operação de atendimento e vendas que se opera sozinha, se audita e prova o resultado."

**Frase de categoria** (a linha que ensina a categoria, subtítulo do hero):

> "Não é um chatbot. É a sua operação de atendimento e vendas rodando sozinha, com CRM que se preenche na origem e uma IA que se corrige e te mostra o número."

---

## 3. Arquitetura de mensagem: mensagem-mãe mais seis pilares

A mensagem-mãe se sustenta em seis pilares. Cada um segue a mesma estrutura: a dor do PME, a capacidade da ZappIQ, os produtos que a sustentam e o resultado mensurável. Prova antes de promessa: onde a capacidade é parcial ou em construção, está marcado, e o número ilustrativo vem rotulado.

### Visão geral dos pilares

| Pilar | A promessa em uma linha |
|---|---|
| 1. Atendimento que resolve | Atende 24/7 em texto e áudio, resolve sozinho, chama o humano só no que importa |
| 2. Vendas que a IA fecha e prova | Qualifica, cria o follow-up e tem a receita atribuída a ela |
| 3. Campanhas que vendem pela base | Um objetivo em português vira campanha, e quem responde cai no atendimento da Iza |
| 4. CRM que se preenche sozinho | O dado de venda entra limpo na origem, sem digitação |
| 5. Agenda cheia sem secretária | A IA marca, remarca e cancela na conversa, sem alucinar horário |
| 6. Confiança auditável | A IA se corrige com você aprovando, e a operação se mede e se explica todo dia |

**Faixa transversal (fundação, embaixo de todos os pilares):** zero setup fee, mensalidade fixa sem cobrança por conversa dentro da franquia, trial de 14 dias sem cartão sem fidelidade, dados no Brasil e LGPD no núcleo. Essas são as bandeiras invioláveis e o piso de confiança que envolve os seis pilares.

---

### Pilar 1. Atendimento que resolve, não só responde

- **Dor:** a fila de WhatsApp e Instagram cresce, a resposta demora, o cliente fica sem resposta à noite e no fim de semana, e cada atendente novo é mais folha.
- **Capacidade ZappIQ:** um agente autônomo (a Iza, renomeável) atende 24/7 nos canais Meta, em texto e áudio, resolve o grosso sozinho e passa para o humano só o que precisa de gente, com o contexto inteiro.
- **Produtos que sustentam:** Iza (agente com regras invioláveis mais classificador de intenção), Multicanal Meta (WhatsApp mais Instagram Direct no mesmo agente), Voz Nativa (áudio in e out em pt-BR), Inbox em tempo real, Transbordo humano, Corrigir e Treinar inline. Echo Copilot (sugestão ao atendente) entra a partir do Growth, com a ressalva de que hoje é flag de plano sem backend de runtime confirmado: validar antes de virar claim de hero.
- **Resultado mensurável:** por cento de atendimentos resolvidos pela IA, tempo de primeira resposta, CSAT. Número ilustrativo (base beta, rotular): a Iza resolve cerca de 65 por cento dos atendimentos sem humano.

### Pilar 2. Vendas que a IA fecha e prova

- **Dor:** o lead quente esfria porque ninguém respondeu a tempo, o vendedor esquece o follow-up, e no fim do mês ninguém sabe dizer quanto a IA de fato ajudou a vender.
- **Capacidade ZappIQ:** a IA detecta intenção de compra, cria o follow-up sozinha e, quando o deal fecha, atribui a receita à conversa. Vendas viram número, não achismo.
- **Produtos que sustentam:** Iza, Tarefas e Follow-ups da IA (task dedupada por intenção de compra), Deal Attribution mais AI Influence Score, Maestro (fluxos de qualificação BANT).
- **Resultado mensurável:** leads qualificados, vendas atribuídas à IA em reais, valor influenciado por deal. Número ilustrativo (rotular): conversão mais 30 por cento.

### Pilar 3. Campanhas que vendem pela base (Impulso)

- **Dor:** a base de contatos está parada, ninguém tem tempo nem repertório de marketing para reativá-la, e disparo malfeito arrisca bloqueio.
- **Capacidade ZappIQ:** você escreve o objetivo em português ("reativar quem não compra há 60 dias") e a IA devolve a campanha inteira: segmento, canais, copy na voz da marca, horário, plano de verba e estimativa. Dispara na API oficial, e quem responde cai direto no atendimento da Iza.
- **Produtos que sustentam:** Impulso (add-on), Iza Estrategista, Coach de campanha determinístico, Templates HSM da Meta. Status honesto: o núcleo (broadcast mais Estrategista mais Coach mais scheduler) está live como add-on em soft launch; o Loop de Receita (Click-to-WhatsApp, Meta Lead Ads, CAPI, atribuição ad-para-venda, TikTok, bandit) é **em breve**, não anunciar como atual.
- **Resultado mensurável:** entregue, lido, respondido, taxa de reativação, receita de campanha. Preço de software, mensagens de marketing Meta pela carteira de disparos (passthrough transparente, não sugerir custo marginal zero).

### Pilar 4. CRM que se preenche sozinho

- **Dor:** o CRM está sujo ou vazio porque o vendedor não registra, o dado se perde entre a conversa e a planilha, e o pipeline nunca reflete a realidade.
- **Capacidade ZappIQ:** a cada turno da conversa, a IA atualiza o contato: primeiro toque, leadStatus, estágio do funil, leadScore de 0 a 100 e timeline. Dado limpo capturado na origem, sem ninguém digitar.
- **Produtos que sustentam:** CRM integrado (contas, contatos, deals, pipeline, ficha 360), CRM Automation, funil de conversão.
- **Resultado mensurável:** contatos qualificados sem digitação, pipeline sempre atualizado, leadScore por contato. Este é o pilar que resolve a dor número um do mercado (CRM sujo) e é dos atributos mais únicos: pouca gente captura o dado na origem da conversa.

### Pilar 5. Agenda cheia sem secretária

- **Dor:** no-show alto, ida e volta manual para marcar horário, agenda no papel ou numa planilha que ninguém atualiza.
- **Capacidade ZappIQ:** a IA marca, remarca e cancela dentro da conversa, respeitando as regras que o dono definiu (janelas, buffers, lembretes), com agenda interna como fonte da verdade e sync com Google Calendar, sem prometer horário que não existe.
- **Produtos que sustentam:** Agendamento pela IA (tool-loop mais RAG de regras), sync Google Calendar. Status honesto: agenda interna em produção; sync Google Calendar [confirmar] (o conector OAuth já existe no código e no ARCHITECTURE, mas o roadmap interno ainda trata como Fase 2, alinhar antes de anunciar como capacidade atual); Microsoft 365, roteamento por equipe, sinal e pré-pagamento são **em breve**.
- **Resultado mensurável:** agendamentos feitos pela IA, redução de no-show (meta ilustrativa, rotular). Empacotamento: incluído a partir do Growth, add-on de R$ 49 no Lite.

### Pilar 6. Confiança auditável: a IA que se corrige e a operação que se mede

- **Dor:** o dono tem medo de a IA alucinar ou fugir do script na frente do cliente, medo de LGPD, e a sensação de "não sei o que está acontecendo lá dentro".
- **Capacidade ZappIQ:** a plataforma roda cenários contra o agente, dá um score, sugere a correção, o humano aprova e a plataforma re-verifica e aprende, em minutos, com trilha de auditoria. Em paralelo, o Pulso lê os números do dia e narra em português de dono o que aconteceu e o que fazer, sobre fatos, nunca inventando número. E a governança LGPD está no núcleo.
- **Produtos que sustentam:** loop de auto-correção auditada (Agent Quality), Radar 360 e Pulso, Analytics, governança LGPD (audit log com cadeia de hash, DSR self-service, RLS multi-tenant), SLA contratual 99,9 por cento com créditos no Scale. Status honesto: loop, Pulso, analytics, audit e DSR em produção; o BI preditivo avançado do Radar 360 (cohort, ML, export Power BI) é parcial.
- **Resultado mensurável:** score de qualidade do agente ao longo do tempo (três números antes, três depois), narrativa diária do Pulso com ação sugerida, prova de compliance (DPA, exclusão de titular, incidente em 72h). Remover da copy qualquer alegação de ser "o único" com humano no loop: o diferencial é a combinação (agêntico mais auditado mais humano aprova mais aprende rápido), não a categoria isolada.

---

## 4. Narrativa de ponta a ponta e autônoma

Os seis pilares não são seis produtos soltos. São uma operação só, com um cérebro só e uma aprovação só. A narrativa abaixo costura os produtos num único fio, e é ela que justifica a categoria "operação autônoma" em vez de "lista de features". Deve virar uma seção de peso na home (a "jornada de um lead").

**Um lead, do anúncio à receita, sem você tocar:**

1. **Chega o lead.** Um cliente clica no anúncio do Instagram e manda uma DM. A **Iza** responde em segundos, em texto ou áudio, na voz da sua marca (Pilar 1).
2. **O CRM enche sozinho.** Enquanto conversa, a IA já cria o contato, marca o estágio do funil e dá o leadScore. Você não digitou nada (Pilar 4).
3. **A IA qualifica e agenda.** A Iza entende que é intenção de compra, qualifica pelo fluxo que o **Maestro** montou, e marca a consulta na **agenda**, checando o horário real (Pilares 2 e 5).
4. **A venda fecha e vira número.** O deal fecha, e a **atribuição** credita a Iza pela receita que passou por ela. No fim do mês você vê, em reais, quanto a IA vendeu (Pilar 2).
5. **A base volta a comprar.** Na semana seguinte, você diz ao **Impulso** "reativar quem parou há 60 dias". A campanha sai pronta, dispara, e quem responde cai de novo no atendimento da Iza, fechando o ciclo (Pilar 3).
6. **A operação se explica e se corrige.** Todo dia o **Pulso** te conta o que aconteceu e o que fazer. E quando o loop de auto-correção pega a Iza desviando do script, ele sugere o ajuste, **você aprova**, e a plataforma comprova a correção em minutos (Pilar 6).

**A frase que resume a narrativa:** um cérebro, uma aprovação, uma operação. O concorrente entrega uma peça (o bot, ou o CRM, ou o disparo) e deixa você integrar o resto. A ZappIQ entrega a operação inteira já costurada, e o que a IA faz sozinha, você aprova antes de ir para o cliente.

Este é o argumento anti-colcha-de-retalhos e anti-headcount, e é o que nenhum concorrente brasileiro no ticket de PME consegue contar com o código na mão.

---

## 5. Nova arquitetura de informação do site

A IA atual tem páginas órfãs, âncoras quebradas, legais duplicados e slugs errados. A nova IA reflete a categoria: **Produtos** por módulo (primeira classe, hoje inexistentes), **Soluções** por job (o comprador chega pela dor), **Segmentos** por vertical, e um hub de **Confiança** que transforma a governança em argumento de venda. Cada página tem um propósito único, para não canibalizar SEO nem confundir o comprador.

### Home e conversão

| Página | Propósito |
|---|---|
| `/` | Home reposicionada: a operação autônoma, a Iza como rosto, a narrativa de ponta a ponta, prova e preço. Ver seção 6 |
| `/cadastro` | Wizard de signup (Magic Link mais Google), mínimo de campos, reforço "sem cartão" |
| `/demo` | Tour interativo ungated do produto real ("Ver a Iza trabalhando"), por caso de uso |
| `/agendar` | Conversa de 30 min com especialista (para quem quer humano antes) |

### Produtos (por módulo, primeira classe, novo)

| Página | Propósito |
|---|---|
| `/produtos` | Hub do ciclo: mostra os módulos como uma operação, não como lista. Conserta o mega-menu quebrado |
| `/iza` | O agente: atende, vende, agenda, dispara, atualiza o CRM. Frame "contrate a Iza" |
| `/maestro` | A IA constrói o fluxo, você aprova e versiona. Auto-otimização e simulação marcadas "em breve" |
| `/crm` | CRM que se preenche sozinho e atribui receita à IA. O maior gap atual do site |
| `/campanhas` | Impulso: objetivo em português vira campanha. Add-on, Loop de Receita "em breve" |
| `/agendamento` | Agenda pela IA com Google Calendar, sem alucinar horário |
| `/voz` | Voz Nativa (áudio in e out), pacotes de minutos. Já existe, tirar da orfandade |
| `/radar` | Radar 360 e Pulso: a operação medida e narrada. Substitui /observabilidade, corrige preços |
| `/qualidade` | O loop de auto-correção auditada. Diferencial concreto, sem "único" |

### Soluções (por job, o comprador chega pela dor)

| Página | Propósito |
|---|---|
| `/solucoes/atender` | Atender 24/7 em texto e áudio sem contratar |
| `/solucoes/vender` | Vender e qualificar, com a IA fechando e provando |
| `/solucoes/reativar-base` | Vender de novo para quem já é cliente (campanhas) |
| `/solucoes/organizar-e-medir` | CRM limpo e operação medida sem analista |

### Segmentos (verticais, corrigir slugs e o hub 404)

| Página | Propósito |
|---|---|
| `/segmentos` | Hub de verticais (hoje dá 404, criar) |
| `/segmentos/varejo` | Landing de varejo e e-commerce |
| `/segmentos/saude` | Landing de clínicas e saúde |
| `/segmentos/servicos-b2b` | Landing de serviços e B2B |
| `/segmentos/educacao` | Landing de educação (corrigir o slug com acento) |

### Preços, comparativo e migração

| Página | Propósito |
|---|---|
| `/precos` | Página de preços completa: núcleo incluído, add-ons em cards, toggle com economia, FAQ de billing, Growth único destaque. Corrigir metadata |
| `/comparativo` | ZappIQ contra os concorrentes, com o bloco de custo total transparente (setup, cobrança por conversa, fidelidade), substanciado |
| `/migracao-zenvia`, `/migracao-blip`, `/migracao-poli` | Uma página de migração por concorrente (páginas de migração convertem mais que jogar tráfego na home) |
| `/founders` | Cohort Founders 2026 (50 vagas, 30 por cento vitalício). Escassez real |

### Confiança (governança como venda, novo hub)

| Página | Propósito |
|---|---|
| `/seguranca-lgpd` | LGPD no núcleo: DPA, DPO, exclusão de titular, incidente 72h, dados no Brasil. Só claims verificados |
| `/sla` | SLA 99,9 por cento com créditos (Scale). Corrigir referência ao "Business" legado |

### Recursos e empresa

| Página | Propósito |
|---|---|
| `/recursos` | Iscas e lead magnets (e-books, calculadora ROI, checklist de migração). Tirar da orfandade |
| `/blog` mais posts | Conteúdo de SEO e GEO, com autoria e data |
| `/roadmap` | Timeline transparente reescrita (Impulso, Agendamento, Pulso, auto-correção). Hoje obsoleta |
| `/novidades-meta` | Meta Business Agent, usernames, pagamentos no chat |
| `/sobre` | Tese, time, o selo "A Platform MACHIA Company", CNPJ correto |
| `/parceiros`, `/carreiras`, `/contato` | Programa de parceiros, vagas, canais oficiais |
| `/legal/*` | Hub legal consolidado. Eliminar os duplicados `/privacy` e `/terms` (redirect 308 para `/legal/*`) |

### O que remover ou consolidar

- Eliminar `/privacy`, `/terms`, `/data-deletion` como páginas soltas (redirect para `/legal/*`).
- Eliminar `/home` (mesma home duplicada em `/`, risco de conteúdo duplicado).
- Absorver `/observabilidade` em `/radar` e `/vendedor-digital` na nova home mais `/solucoes/vender` (a narrativa "fim do chatbot" vira a tese central, não uma página órfã).

---

## 6. Nova ordem de seções da HOME

A ordem segue uma lógica de convencimento: **problema, agente, amplitude, prova, confiança, preço, fechamento**. Primeiro a dor (para ativar a categoria certa), depois a Iza como rosto, depois a operação inteira e a narrativa que a costura, depois a prova, depois a confiança, e só então preço e fechamento.

| Ordem | Seção | Mensagem central | Racional |
|---|---|---|---|
| 1 | Barra de novidade (opcional) | Meta Business Agent, a ZappIQ entre as primeiras | Reforça o selo Meta, mas reescrita para a categoria, não só notícia |
| 2 | Hero | "A Iza atende, vende e faz campanha pela sua operação. Você aprova, ela executa." CTA duplo (começar 14 dias, ver a Iza trabalhando) mais chips de risco reverso | Outcome-first mais categoria embutida mais Iza personificada. Um CTA primário. Prova antes de promessa |
| 3 | Faixa de prova mais logos | Um número acima da dobra mais 3 a 5 logos reais | Padrão Fin e Gorgias. Número real e verificável, senão não exibir |
| 4 | O problema (a colcha de retalhos e o headcount) | "Hoje: cinco ferramentas soltas e gente atendendo. Com a ZappIQ: uma operação que roda sozinha." | Ativa a alternativa competitiva certa (manual e colcha de retalhos, não "outro bot"). Reaproveita o ComVsSem, reenquadrado |
| 5 | A Iza (contrate a Iza) | Terceira pessoa, verbos autônomos: atende, qualifica, vende, agenda, dispara, atualiza o CRM | Frame Fin e Artisan. A Iza é o rosto da operação, resolve o risco de "só um bot" |
| 6 | A operação inteira (features por job) | Quatro jobs em bento: Atender 24/7, Vender e qualificar, Fazer campanhas, Organizar e medir | Multi-produto por job, não por lista de nomes. O achado mais seguro para multi-produto |
| 7 | Narrativa de ponta a ponta (a jornada de um lead) | Do anúncio à receita, sem você tocar: Iza, CRM, Maestro, Agenda, Atribuição, Impulso, Pulso costurados | O coração do reposicionamento. Prova que é operação, não lista. Seção nova e de peso |
| 8 | Loop de auto-correção auditada | Detecta, dá score, sugere, você aprova, comprova em minutos | Capacidade-estrela de todo líder. Diferencial concreto, sem "único" |
| 9 | Observabilidade (Radar e Pulso) | A operação medida e narrada todo dia, sobre fatos | Confiança e prova de resultado. Três números antes, três depois |
| 10 | Omnichannel mais Voz Nativa | WhatsApp e Instagram, texto e áudio, mesma marca | Do jeito que o brasileiro usa o WhatsApp. Já bem executado hoje |
| 11 | Calculadora ROI | Diga seus números, veja o payback | Prova pública. Números ilustrativos rotulados |
| 12 | Cases | Depoimento com nome, cargo, empresa e número real | Prova social específica. Nunca case fabricado (bloqueio LGPD) |
| 13 | Faixa de confiança e LGPD | Dados no Brasil, DPA, exclusão de titular, SLA no Scale | Espaço vago no mercado BR. Só claims verificados |
| 14 | Preço (teaser) | Lite 247, Growth 497 (único destaque), Scale 1497, Enterprise. Zero setup, mensalidade fixa, sem cartão | Um só destaque. Bandeiras invioláveis junto ao CTA |
| 15 | Comparativo e objeção | Bloco de custo total transparente, link para /comparativo e migração | Ataca a brecha central do mercado BR (setup, por conversa, fidelidade) |
| 16 | FAQ | Perguntas de billing e de fit, com schema FAQPage | GEO e AEO. Responde a objeção antes de o comprador sair |
| 17 | CTA de fechamento mais Founders | "Comece hoje, 14 dias grátis, sem cartão" mais selo Founders 2026 | Fechamento com risco reverso e escassez legítima |

**Lógica da ordem, em uma frase:** a home abre pela dor (seção 4) para o comprador se reconhecer na categoria certa, apresenta a Iza como o rosto da solução (5), abre a amplitude por job (6), prova que é uma operação e não uma lista com a narrativa costurada (7), ancora a confiança no que é único e auditável (8 e 9), entrega a prova (11 e 12), remove o medo (13), só então fala preço com um único destaque (14), derruba a objeção de custo (15) e fecha com risco reverso e escassez real (17).

---

## Guardrails finais (não violar)

1. **Copy:** pt-BR com acentuação completa, sem travessão. Voz piloto-instrutor: tranquilo, técnico, decisivo, frases curtas, prova antes de promessa. Nunca "transformação digital", "solução inovadora", "ferramenta poderosa", "revolução da IA".
2. **Bandeiras invioláveis:** zero setup fee; mensalidade fixa sem cobrança por conversa (verdade dentro da franquia, há overage cerca de R$ 0,03 por mensagem e passthrough Meta nos disparos, a copy não pode sugerir custo marginal zero); trial de 14 dias sem cartão sem fidelidade; implementação assistida é consultoria MACHIA, nunca taxa da plataforma.
3. **Números beta** (Iza cerca de 65 por cento, mais 30 por cento, payback 90 dias) sempre rotulados como ilustrativos, com a moldura do `blogData.ts`. Nunca como métrica de caso auditado.
4. **Claims de fato com risco jurídico** (Meta Business Partner, dados no Brasil, SLA 99,9 por cento, incidente 72h, comparativo nominal) só ao ar após confirmação de engenharia e jurídico, e substanciação CDC e CONAR no comparativo.
5. **"Agêntico" é higiene de categoria, não moat.** Zaia e Zendesk BR já ocupam o termo. O diferencial defensável é a **combinação**: amplitude multi-produto no ticket de PME, autonomia com aprovação, auto-correção auditada, CRM que se preenche na origem, zero setup, mensalidade fixa e dados no Brasil.
6. **Sem "único" ou "exclusivo"** na copy do loop auditado. O valor é a combinação, não a exclusividade.
7. **Status honesto por pilar:** o que é parcial (Echo Copilot runtime, Radar 360 BI preditivo) ou em construção (Loop de Receita do Impulso, Microsoft 365 no Agendamento, Maestro auto-otimização, Central de Ajuda e Iza Ajuda, Vision inbound, Memory Mem0, Outcome) entra como "em breve" ou fica fora do ar, nunca como capacidade atual.
