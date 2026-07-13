# Plano de SEO e implementação da ZappIQ

**Autor:** Head de SEO e gerente de projeto técnico
**Data:** 10/07/2026
**Base:** brief de melhores práticas (`00-pesquisa-melhores-praticas.md`), estratégia de reposicionamento (`01-estrategia-reposicionamento.md`) e o inventário de código verificado (`~/zappiq-main`, monorepo Next.js App Router na Vercel).
**Objetivo:** dar ao reposicionamento (de "plataforma de IA conversacional" para "operação autônoma de atendimento e vendas") uma camada de SEO e uma sequência de implementação acionável, priorizada por impacto x esforço.

## Como ler este plano

- Domínio: `https://zappiq.com.br`. Stack: Next.js App Router (RSC) na Vercel, SSR real (o HTML já vem renderizado, ótimo para indexação e para crawlers de IA).
- Entidade oficial: **MACHIA Tecnologia Disruptiva Ltda** (d.b.a. ZappIQ), CNPJ 46.788.145/0001-08, selo "A Platform MACHIA Company", Meta Business Partner, dados processados e armazenados no Brasil, em São Paulo.
- Planos ativos (fonte única `packages/shared/src/planConfig.ts`): **Lite R$ 247, Growth R$ 497 (mais popular), Scale R$ 1.497, Enterprise sob consulta**. Desconto anual: menos 20 por cento em Lite, Growth e Scale; menos 10 por cento no Enterprise. Starter e Business são legados ocultos, não citar.
- Regra de copy: português do Brasil com acentuação completa, **sem travessão**. Vírgula, dois-pontos, parênteses ou ponto no lugar.
- Números beta (Iza resolve cerca de 65 por cento, conversão mais 30 por cento, payback 90 dias) só entram rotulados como ilustrativos. Claims de fato com risco jurídico só ao ar após engenharia e jurídico. Números de volume de busca neste plano são **estimativas de ordem de grandeza** (não há ferramenta de keyword conectada nesta sessão); calibrar no Search Console e numa ferramenta de volume antes de fechar metas.

## Estimativa estimada usada nas tabelas

- **Volume:** faixa mensal Brasil (baixo menor que 200, médio 200 a 1.000, alto maior que 1.000). Sinalizado como estimativa.
- **Dificuldade:** facilidade de ranquear no cenário BR (baixa, média, alta), considerando domínio novo e concorrência de Blip, Zenvia, RD, Poli.
- **Prioridade:** P0 (fundo de funil, receita direta), P1 (meio de funil), P2 (topo e confiança).

---

## 1. Estratégia de SEO on-page por página

Regra transversal para todas as páginas: um único H1 por página, `title` entre 50 e 60 caracteres, `meta description` entre 140 e 160 caracteres com a keyword-alvo e uma bandeira (zero setup ou 14 dias grátis), canonical próprio absoluto, `og:title`/`og:description`/`og:image`/`og:url` próprios. Banir "chatbot", "conversacional", "pulse ai" e travessão de todos os campos. Os H1 abaixo já vêm sem travessão.

### 1.1 Home (`/`)

- **Keyword-alvo primária:** "plataforma de IA para WhatsApp" (comercial). **Secundárias:** "atendimento e vendas com IA no WhatsApp", "IA para WhatsApp e Instagram".
- **Title (56):** `ZappIQ: IA que atende, vende e faz campanha no WhatsApp`
- **Meta description (152):** `A Iza atende, vende e faz campanha no WhatsApp e Instagram, com CRM que se preenche sozinho. Zero setup, mensalidade fixa, 14 dias grátis sem cartão.`
- **H1:** `A Iza atende, vende e faz campanha pela sua operação. Você aprova, ela executa.`
- Notas: corrigir o `title` raiz atual ("IA para WhatsApp sem setup fee", só WhatsApp) e a `description` raiz (só conversacional). Incluir Instagram, CRM e vendas.

### 1.2 Hub de produtos (`/produtos`, novo)

- **Keyword-alvo:** "plataforma agêntica de atendimento e vendas" (comercial). **Secundária:** "ferramenta de IA para atendimento e vendas no WhatsApp".
- **Title (58):** `Produtos ZappIQ: a operação de atendimento e vendas com IA`
- **Meta description (149):** `Conheça os módulos da ZappIQ: Iza, Maestro, CRM, Campanhas, Agendamento, Voz Nativa e Radar. Uma operação que roda sozinha, você aprova, ela executa.`
- **H1:** `Uma operação inteira, num lugar só`
- Notas: este hub conserta o mega-menu quebrado (âncora `#produtos` inexistente hoje). Cada card linka para a página de produto real.

### 1.3 Iza (`/iza`, novo)

- **Keyword-alvo:** "agente de IA para WhatsApp" (comercial). **Secundária:** "agente de IA para vendas".
- **Title (54):** `Iza: o agente de IA que atende e vende no WhatsApp`
- **Meta description (156):** `A Iza atende, qualifica, vende, agenda e atualiza o CRM sozinha, no WhatsApp e Instagram, em texto e áudio. Você aprova, ela executa. Teste 14 dias grátis.`
- **H1:** `Contrate a Iza, o agente que opera o seu atendimento e as suas vendas`

### 1.4 Maestro (`/maestro`, novo)

- **Keyword-alvo:** "automação de atendimento WhatsApp com IA" (comercial). **Secundária:** "construtor de fluxo WhatsApp".
- **Title (57):** `Maestro: a IA monta o fluxo de atendimento, você aprova`
- **Meta description (150):** `No Maestro, a IA constrói o fluxo do seu atendimento a partir do seu negócio. Você vê no canvas, ajusta, aprova e versiona cada passo. Sem consultor.`
- **H1:** `A IA constrói o fluxo. Você aprova e versiona.`

### 1.5 CRM (`/crm`, novo, maior gap do site atual)

- **Keyword-alvo:** "CRM no WhatsApp" (comercial). **Secundária:** "CRM integrado WhatsApp".
- **Title (55):** `CRM no WhatsApp que se preenche sozinho, ZappIQ`
- **Meta description (154):** `O CRM da ZappIQ se preenche a cada conversa: contato, funil e lead score sem digitação. E atribui a receita à IA. Dado limpo capturado na origem da venda.`
- **H1:** `O CRM que se preenche sozinho, na origem da conversa`

### 1.6 Campanhas / Impulso (`/campanhas`, novo)

- **Keyword-alvo:** "disparo em massa WhatsApp" (comercial). **Secundária:** "campanha WhatsApp API oficial", "reativar clientes WhatsApp".
- **Title (58):** `Campanhas no WhatsApp com IA: disparo pela API oficial`
- **Meta description (157):** `Escreva o objetivo em português e a IA monta a campanha inteira: público, copy, horário e verba. Disparo pela API oficial, e quem responde cai no atendimento da Iza.`
- **H1:** `Um objetivo em português vira campanha pronta`
- Notas: Loop de Receita (Click-to-WhatsApp, Meta Lead Ads, CAPI, TikTok) marcado "em breve", não é claim atual.

### 1.7 Agendamento (`/agendamento`, novo)

- **Keyword-alvo:** "agendamento automático WhatsApp" (comercial). **Secundária:** "agendar cliente pela IA", "marcar consulta pelo WhatsApp".
- **Title (57):** `Agendamento pela IA no WhatsApp com Google Calendar`
- **Meta description (151):** `A Iza marca, remarca e cancela dentro da conversa, checando o horário real, com agenda interna e sync Google Calendar. Agenda cheia sem secretária.`
- **H1:** `A IA agenda pela conversa, sem alucinar horário`

### 1.8 Voz Nativa (`/voz`, já existe, tirar da orfandade)

- **Keyword-alvo:** "resposta em áudio WhatsApp" (informacional e comercial). **Secundária:** "transcrição de áudio no atendimento".
- **Title (56):** `Voz Nativa: a IA entende e responde em áudio no WhatsApp`
- **Meta description (149):** `A Iza entende os áudios do cliente e responde por voz natural em português, do jeito que o brasileiro usa o WhatsApp. Áudio de entrada incluído em todos os planos.`
- **H1:** `Áudio no WhatsApp, do jeito que o brasileiro conversa`

### 1.9 Radar 360 e Pulso (`/radar`, novo, absorve `/observabilidade`)

- **Keyword-alvo:** "métricas de atendimento WhatsApp" (comercial e informacional). **Secundária:** "BI de atendimento", "relatório de atendimento WhatsApp".
- **Title (57):** `Radar e Pulso: a operação medida e narrada todo dia`
- **Meta description (150):** `O Radar mede a sua operação e o Pulso narra em português o que aconteceu e o que fazer, sobre fatos. Três números antes, três números depois. Sem analista.`
- **H1:** `A sua operação medida e explicada todo dia`
- Notas: corrigir a tabela de preço fantasma da antiga `/observabilidade` (Starter 297 etc). Redirecionar `/observabilidade` para `/radar` (308).

### 1.10 Qualidade da IA (`/qualidade`, novo)

- **Keyword-alvo:** "IA que não alucina no atendimento" (informacional). **Secundária:** "qualidade de agente de IA", "auditoria de IA no atendimento".
- **Title (56):** `Qualidade da IA: a Iza se corrige, você aprova, ZappIQ`
- **Meta description (155):** `A plataforma testa a IA, detecta desvio, dá score, sugere a correção, você aprova e ela comprova o ajuste em minutos, com trilha de auditoria. Confiança auditável.`
- **H1:** `A IA que se corrige com você no comando`
- Notas: sem a palavra "único" na copy nem no schema.

### 1.11 Preços (`/precos`, corrigir metadata stale)

- **Keyword-alvo:** "ZappIQ preço" e "quanto custa ZappIQ" (comercial, marca). **Secundária:** "plataforma de IA para WhatsApp preço".
- **Title (52):** `Planos e preços ZappIQ: a partir de R$ 247/mês`
- **Meta description (157):** `Lite R$ 247, Growth R$ 497, Scale R$ 1.497 e Enterprise sob consulta. Zero setup, mensalidade fixa e 14 dias grátis no Lite e Growth. Anual até 20 por cento.`
- **H1:** `Um plano pra cada tamanho, sem pegadinha`
- Notas: remover "Starter" e "a partir de R$ 197" do `title` e `description` atuais (`app/precos/page.tsx` L8/L12). Remover referências ao tier "Business" (SLA começa no Scale).

### 1.12 Comparativo (`/comparativo`)

- **Keyword-alvo:** "ZappIQ vs Zenvia" e "alternativa à Zenvia" (comparativo). **Secundárias:** "alternativa ao Blip", "comparativo plataforma IA WhatsApp".
- **Title (56):** `ZappIQ vs Blip, Zenvia e Poli: comparativo de custo`
- **Meta description (156):** `Compare setup, cobrança por conversa e fidelidade. ZappIQ: zero setup, mensalidade fixa, sem cobrança por conversa de atendimento e sem fidelidade. Veja lado a lado.`
- **H1:** `O custo total, sem letra miúda`
- Notas: usar as correções factuais da seção 5.3 do brief (não citar "setup Zenvia R$ 1.999"; Poli com promo; não publicar valores inferidos de Letalk e Huggy). Comparativo nominal exige substanciação CDC e CONAR.

### 1.13 Hub de segmentos (`/segmentos`, criar, hoje dá 404) e verticais

- **`/segmentos` (hub). Keyword-alvo:** "IA para atendimento por segmento". **Title (55):** `IA para WhatsApp por segmento: escolha o seu, ZappIQ`. **Meta description (146):** `Veja como a ZappIQ opera atendimento e vendas no seu segmento: varejo, saúde, serviços B2B e educação. Uma operação pronta pro seu tipo de negócio.` **H1:** `Escolha o seu segmento`
- **`/segmentos/varejo`. Keyword:** "chatbot IA para e-commerce WhatsApp" / "atendimento WhatsApp para loja". **Title (57):** `IA para varejo e e-commerce no WhatsApp, ZappIQ`. **Meta description (150):** `A Iza atende, recupera carrinho, vende e organiza o CRM da sua loja no WhatsApp e Instagram, 24 horas. Zero setup, 14 dias grátis sem cartão.` **H1:** `Atendimento e vendas do seu varejo, no piloto automático`
- **`/segmentos/saude`. Keyword:** "agendamento e atendimento com IA para clínicas WhatsApp". **Title (56):** `IA para clínicas: agenda e atende no WhatsApp, ZappIQ`. **Meta description (152):** `A Iza marca consulta, confirma, reduz no-show e atende os pacientes da sua clínica no WhatsApp, com LGPD no núcleo. Agenda cheia sem secretária.` **H1:** `A agenda da sua clínica cheia, sem secretária`
- **`/segmentos/servicos-b2b`. Keyword:** "qualificar leads B2B com IA WhatsApp". **Title (57):** `IA para serviços e B2B: qualifica e agenda, ZappIQ`. **Meta description (151):** `A Iza qualifica o lead, agenda a reunião e alimenta o CRM da sua operação de serviços ou B2B, no WhatsApp. Vendas atribuídas à IA, sem digitação.` **H1:** `Leads qualificados e reuniões agendadas pela IA`
- **`/segmentos/educacao` (corrigir slug com acento). Keyword:** "atendimento com IA para escolas e cursos WhatsApp". **Title (56):** `IA para educação: capta e matricula no WhatsApp, ZappIQ`. **Meta description (149):** `A Iza atende interessados, tira dúvidas e agenda matrícula da sua escola ou curso no WhatsApp, 24 horas. Zero setup, 14 dias grátis sem cartão.` **H1:** `Mais matrículas, com a IA atendendo 24 horas`

### 1.14 Soluções por job (`/solucoes/*`, novo, o comprador chega pela dor)

- **`/solucoes/atender`. Keyword:** "atendimento automatizado WhatsApp 24 horas" (comercial). **Title (57):** `Atendimento no WhatsApp 24 horas com IA, sem contratar`. **Meta description (153):** `A Iza atende no WhatsApp e Instagram, texto e áudio, 24 horas, resolve o grosso sozinha e chama o humano só no que importa. Sem contratar mais ninguém.` **H1:** `Atenda 24 horas sem aumentar a folha`
- **`/solucoes/vender`. Keyword:** "agente de IA para vendas no WhatsApp" (comercial). **Title (55):** `Venda mais no WhatsApp com IA que qualifica e fecha`. **Meta description (150):** `A Iza qualifica o lead, cria o follow-up e tem a receita atribuída a ela. No fim do mês você vê, em reais, quanto a IA vendeu. Prova, não achismo.` **H1:** `A IA que vende e prova quanto vendeu`
- **`/solucoes/reativar-base`. Keyword:** "campanha de reativação de clientes WhatsApp" (comercial). **Title (56):** `Reative clientes parados com campanha no WhatsApp`. **Meta description (152):** `Escreva "reativar quem não compra há 60 dias" e a IA monta e dispara a campanha pela API oficial. Quem responde cai no atendimento da Iza. Venda pela base.` **H1:** `Faça a sua base comprar de novo`
- **`/solucoes/organizar-e-medir`. Keyword:** "CRM e métricas de atendimento WhatsApp" (comercial). **Title (57):** `CRM limpo e operação medida no WhatsApp, sem analista`. **Meta description (150):** `CRM que se preenche sozinho e Radar que mede tudo, com o Pulso narrando o dia. Organize e meça a sua operação sem planilha e sem analista de BI.` **H1:** `CRM limpo e operação medida, sem trabalho manual`

---

## 2. Plano de dados estruturados (JSON-LD)

Regra geral: um bloco `<script type="application/ld+json">` por tipo, injetado por Server Component, com URLs absolutas e dados batendo com o `planConfig.ts`. Validar todo schema no Rich Results Test e no Schema Markup Validator antes de publicar. **Remover hoje os dois defeitos confirmados:** o `aggregateRating` fabricado (4,8 / 500) e o `AggregateOffer` defasado (297 a 997, 3 ofertas). Unificar os dois `Organization` conflitantes (foundingDate 2025 vs 2026) num único bloco.

| Schema | Onde aplicar | Conteúdo e cuidados |
|---|---|---|
| **Organization** (único, site-wide no layout) | Todas as páginas, via `layout.tsx` | `name` ZappIQ, `legalName` "MACHIA Tecnologia Disruptiva Ltda", `identifier` CNPJ 46.788.145/0001-08, `url`, `logo` absoluto, `foundingDate` (um só valor, confirmar com o Rodrigo, remover o placeholder 2025), `address` São Paulo, `contactPoint` (vendas, suporte, DPO dpo@zappiq.com.br), `sameAs` só perfis reais (LinkedIn, Instagram). Amarrar o selo MACHIA via `parentOrganization` ou `brand`. Corrigir a razão social "ONZE E ONZE" nos legais para não contradizer o schema. |
| **WebSite** (site-wide) | `layout.tsx` | `WebSite` com `potentialAction` `SearchAction` (sitelinks searchbox) se houver busca no site; `inLanguage` pt-BR. |
| **SoftwareApplication** (ou `Product`) | Home, `/produtos`, `/precos` | `applicationCategory` BusinessApplication, `operatingSystem` Web, `offers` como `AggregateOffer` real: `lowPrice` 247, `priceCurrency` BRL, `offerCount` refletindo os tiers com preço (Lite, Growth, Scale), mais `Offer` individual por plano. Enterprise fica como `Offer` sem preço (`price` ausente, `availability`). **Sem `aggregateRating` até haver reviews reais.** |
| **Offer** (por plano) | `/precos` | Um `Offer` por tier ativo, com `price`, `priceCurrency` BRL, `priceValidUntil`, `url` da âncora do plano. Não incluir Starter nem Business (legados). |
| **FAQPage** | `/precos` (FAQ de billing), home (FAQ), cada `/produtos/*`, `/solucoes/*`, `/comparativo` | Perguntas e respostas reais e extraíveis. É a estrutura que answer engines mais citam. Manter o texto da resposta idêntico ao visível na página (evitar cloaking). |
| **BreadcrumbList** | `/produtos/*`, `/solucoes/*`, `/segmentos/*`, `/blog/*` | Trilha com `itemListElement` (Início, Seção, Página). Melhora o snippet e a navegação para crawler. |
| **Service** (opcional) | `/solucoes/*` | `Service` com `serviceType` (Atendimento, Vendas, Campanhas), `provider` Organization, `areaServed` BR. Reforça a semântica de job. |
| **BlogPosting / Article** | Cada post do `/blog` | `headline`, `author` (Person real), `datePublished`, `dateModified`, `image`, `publisher` Organization. Alimenta E-E-A-T e GEO. |
| **Review / AggregateRating** | Home, `/precos` (só quando houver base real) | **NÃO publicar até existirem avaliações reais e verificáveis.** Plano: coletar depoimento com nome, cargo, empresa e consentimento pós-onboarding, e só então adicionar `Review` individuais e o `AggregateRating` com `ratingCount` verdadeiro. Rating fabricado é risco de penalidade de rich result e fere a política de honestidade. |

Notas de implementação:
- Centralizar os schemas num módulo `components/seo/` com uma função por tipo, chamada por Server Component, para evitar os dois blocos conflitantes de hoje.
- `metadataBase` deve apontar para `https://zappiq.com.br` (garante URLs absolutas em OG e canonical).

---

## 3. SEO técnico

### 3.1 Core Web Vitals e INP

Metas: **LCP menor que 2,5s, INP menor que 200ms, CLS menor que 0,1** no p75 mobile (campo, não lab).

- **Renderização:** manter Server Components como padrão. Isolar as ilhas client (ROICalculator, toggle de preços, demo, calculadora) em componentes pequenos, com `dynamic(() => import(...), { ssr: false })` para o que é abaixo da dobra e pesado. Cada widget interativo é um ponto de risco de INP: reduzir JS hidratado no above-the-fold.
- **Imagens:** `next/image` com `sizes` corretos, `priority` só no LCP do hero, `max-width: 100%`, dimensões explícitas para CLS zero. Servir AVIF/WebP.
- **Fontes:** `next/font` self-host com `display: swap` (o preload de woff2 já existe, manter). Evitar FOIT.
- **Hero:** sem vídeo pesado. O mockup animado do iPhone deve ser CSS/SVG ou imagem otimizada, não vídeo autoplay.
- **Terceiros (GTM):** carregar via `next/script` com `strategy="afterInteractive"` e avaliar **Partytown** para mover o GTM e as tags para um web worker, protegendo o INP. Auditar as tags do container: cada script síncrono no GTM come INP.
- **Medição contínua:** ligar **Vercel Speed Insights** (campo real) e acompanhar o CrUX no Search Console (relatório Core Web Vitals).

### 3.2 Cacheabilidade (ganho de TTFB e LCP)

- Hoje o HTML da home vem `private, no-cache, no-store` com `x-vercel-cache MISS` (render dinâmico, não cacheado no CDN). Para páginas de marketing, migrar para **geração estática com ISR** (`export const revalidate = 3600` ou similar) para o CDN da Vercel servir a partir do edge e o TTFB cair. Usar `generateStaticParams` nas páginas de segmento e solução. Só manter dinâmico o que precisa (ex.: dispatcher de prelaunch), e nesse caso separar a rota.

### 3.3 Sitemap

- Tornar o `app/sitemap.ts` **dinâmico**, gerado a partir de um registro de rotas, não hardcoded. Corrigir os slugs errados (hoje `/segmentos/ecommerce`, `/servicos`, `/educação` dão 404; as rotas reais serão `/segmentos/varejo`, `/saude`, `/servicos-b2b`, `/educacao`).
- Incluir todas as rotas públicas vivas hoje ausentes do sitemap: `/produtos` e filhos, `/solucoes/*`, `/voz`, `/recursos`, `/vendedor-digital` (ou seu destino), `/agendar`, `/contato`, `/conectar-whatsapp`, `/founders`, `/parceiros`, `/sobre`, `/roadmap`, `/migracao-*`, `/blog` e posts.
- Adicionar `lastmod` real por página. `priority` e `changefreq` são opcionais (o Google ignora, mas não atrapalha).
- Não listar `/privacy` e `/terms` (que serão redirecionados). Não listar `/cadastro` nem `/login`.

### 3.4 robots.txt

- Manter `Allow: /` e `Disallow` de `/api/`, `/dashboard/`, `/onboarding`, `/cadastro`, `/login`. As novas páginas de produto, solução e segmento ficam sob `/` e já são permitidas.
- Declarar o sitemap. Manter a verificação do Search Console.
- Adicionar (ver seção 4) a referência ao `llms.txt`.

### 3.5 Canonical e consolidação de duplicatas

- **Self-canonical absoluto** em cada página.
- **Redirects 308** (permanentes, preservam método): `/home` para `/`; `/privacy` para `/legal/privacidade`; `/terms` para `/legal/termos`; `/data-deletion` para `/legal/deletar-dados`; `/observabilidade` para `/radar`. Isso mata o conteúdo duplicado e concentra a autoridade.
- Absorver `/vendedor-digital` na nova home e em `/solucoes/vender` (301/308 conforme decisão), já que a tese "fim do chatbot" vira central.

### 3.6 OpenGraph e imagens sociais

- `og:title`, `og:description`, `og:url`, `og:image` **próprios por página**. Hoje `/observabilidade` e `/recursos` caem no default da home (compartilhamento mostra a marca genérica). Corrigir.
- Gerar imagens OG dinâmicas com `next/og` (`ImageResponse`), uma por template (produto, solução, segmento, blog, preços), com o título da página. Evita criar PNG manual por página e mantém 1200x630.
- `twitter:card summary_large_image`.

### 3.7 i18n pt-BR

- `<html lang="pt-BR">`, `og:locale pt_BR`, `inLanguage pt-BR` nos schemas.
- Site monolíngue: `hreflang` self `pt-BR` e opcional `x-default` apontando para a home. Não criar hreflang para idiomas inexistentes.
- Atualizar o `manifest.ts`: `name`, `short_name` e `description` para o novo posicionamento (incluir Instagram, CRM e vendas, hoje é só "IA para WhatsApp Business"), `lang: "pt-BR"`, `theme_color` consistente com a marca.

### 3.8 Performance no Next.js e Vercel (resumo operacional)

- Static/ISR primeiro, dinâmico só quando necessário.
- `next/image`, `next/font`, `next/script` (com Partytown para GTM).
- Code splitting por rota (já nativo) e `dynamic import` para ilhas pesadas abaixo da dobra.
- Bundle: revisar componentes client grandes (ex.: o antigo `Products.tsx` de 36KB, hoje código morto, não religar como está). Remover código morto.
- Validar tudo **no mobile primeiro** (tráfego BR de PME é majoritariamente mobile).

---

## 4. GEO e AEO (ser citado por motores generativos)

O comprador BR já pergunta a LLMs "qual a melhor plataforma de IA para WhatsApp" e "quanto custa a Zenvia". Para a ZappIQ aparecer nessas respostas:

1. **Bloco de resposta direta no topo de cada seção/página:** responder a pergunta explícita em 2 a 3 frases, em formato pergunta e resposta. É o trecho que os LLMs extraem e citam. Exemplo em `/crm`: "O que é um CRM no WhatsApp? É um CRM que registra contato, funil e lead score direto da conversa, sem digitação. Na ZappIQ ele se preenche sozinho a cada mensagem."
2. **Tabelas factuais e citáveis:** planos, setup, modelo de cobrança e fidelidade. Números precisos e datados são mais citados por IA do que adjetivos. Substanciar antes de publicar (CDC e CONAR no comparativo nominal).
3. **FAQPage com schema** cobrindo billing, fit e definições de categoria. É a estrutura que answer engines preferem.
4. **Entidade clara e consistente:** repetir "ZappIQ, uma empresa MACHIA (MACHIA Tecnologia Disruptiva Ltda)" em site, schema `Organization`, rodapé e diretórios, para o grafo de conhecimento associar a entidade à categoria "operação autônoma de atendimento e vendas no WhatsApp".
5. **Conteúdo com autoria e data:** posts assinados por Person real, com `datePublished` e metodologia aberta (casa com a moldura "ilustrativo" das métricas beta). Aumenta a probabilidade de citação e a confiança do leitor.
6. **Arquivo `llms.txt`** na raiz (`/llms.txt`): um resumo em texto do que é a ZappIQ, os planos, os diferenciais e os fatos canônicos (entidade, dados no Brasil em São Paulo, bandeiras), para os crawlers de IA lerem uma fonte limpa. Manter em sincronia com o site.
7. **SSR garantido:** o site já é server-rendered, então os crawlers de IA veem o conteúdo sem depender de JS. Manter (não migrar conteúdo-chave para render só no cliente).
8. **Presença em fontes que os LLMs leem:** perfis consistentes em diretórios de software pt-BR (Capterra, B2B Stack, e similares) e menções editoriais sobre IA para PME, com o mesmo nome, categoria e dados.

---

## 5. Arquitetura de conteúdo e blog (topic clusters)

Modelo pilar e spokes: cada cluster tem uma página pilar (geralmente uma solução ou um guia) que linka para posts de apoio, e os posts linkam de volta ao pilar. Isso constrói autoridade tópica e alimenta o GEO.

### 5.1 Clusters

| Cluster | Página pilar | Ângulo |
|---|---|---|
| C1. Atendimento com IA no WhatsApp | `/solucoes/atender` | Atende 24/7, texto e áudio, agente autônomo, não chatbot |
| C2. Vendas e CRM no WhatsApp | `/solucoes/vender` e `/crm` | Qualificar, fechar, atribuir receita, CRM que se preenche |
| C3. Campanhas e reativação | `/solucoes/reativar-base` e `/campanhas` | Disparo pela API oficial, objetivo vira campanha |
| C4. Custos e comparativos | `/comparativo` e `/migracao-*` | Setup, por conversa, fidelidade, custo total transparente |
| C5. Confiança: LGPD, qualidade, observabilidade | `/seguranca-lgpd`, `/qualidade`, `/radar` | Dados no Brasil, IA que se corrige, operação medida |
| C6. Segmentos | `/segmentos/*` | A operação por vertical (varejo, saúde, serviços, educação) |

### 5.2 Pautas priorizadas (18)

Intenção: C = comercial, I = informacional, Comp = comparativo.

| # | Pauta (título de trabalho) | Keyword-alvo | Intenção | Cluster | Prioridade |
|---|---|---|---|---|---|
| 1 | Quanto custa a Zenvia em 2026 e o que está incluso | "quanto custa a Zenvia" | Comp | C4 | P0 |
| 2 | Quanto custa o Blip e para quem compensa | "quanto custa o Blip" | Comp | C4 | P0 |
| 3 | WhatsApp API oficial: preço e como funciona a cobrança | "WhatsApp API oficial preço" | C | C4 | P0 |
| 4 | CRM no WhatsApp: o que é e como escolher | "CRM no WhatsApp" | C | C2 | P0 |
| 5 | Chatbot com IA para WhatsApp: por que virou agente autônomo | "chatbot com IA para WhatsApp" | C | C1 | P0 |
| 6 | Atendimento automatizado no WhatsApp: guia para PME | "atendimento automatizado WhatsApp" | C | C1 | P0 |
| 7 | Disparo em massa no WhatsApp sem bloqueio, pela API oficial | "disparo em massa WhatsApp" | C | C3 | P1 |
| 8 | Um número, vários atendentes no WhatsApp: como fazer | "um número vários atendentes WhatsApp" | I | C1 | P1 |
| 9 | Como qualificar leads com IA no WhatsApp | "qualificar leads com IA" | C | C2 | P1 |
| 10 | Agente de IA para vendas: o que faz de ponta a ponta | "agente de IA para vendas" | C | C2 | P1 |
| 11 | Como reativar clientes parados por WhatsApp | "reativar clientes WhatsApp" | C | C3 | P1 |
| 12 | Agendamento automático pela IA no WhatsApp | "agendamento automático WhatsApp" | C | C1 | P1 |
| 13 | Migrar da Zenvia para uma mensalidade fixa: passo a passo | "migrar da Zenvia" | Comp | C4 | P1 |
| 14 | Setup fee em plataforma de WhatsApp: por que existe e como fugir | "setup fee WhatsApp" | I | C4 | P1 |
| 15 | LGPD no atendimento por WhatsApp: o que a PME precisa | "LGPD atendimento WhatsApp" | I | C5 | P2 |
| 16 | Como a IA transcreve e responde áudio no WhatsApp | "transcrição de áudio WhatsApp" | I | C1 | P2 |
| 17 | IA que não alucina no atendimento: como auditar | "IA que alucina atendimento" | I | C5 | P2 |
| 18 | IA para clínicas: agenda e atende no WhatsApp | "IA para clínicas WhatsApp" | C | C6 | P2 |

Cadência sugerida: 2 a 3 posts por semana, começando pelos P0 (fundo de funil, ligam direto a `/comparativo`, `/crm` e `/precos`). Cada post: bloco de resposta direta no topo, tabela factual quando couber, autoria e data, CTA para a solução do cluster, links internos para o pilar.

---

## 6. Mapa de keywords pt-BR priorizado

Volumes são estimativas de ordem de grandeza (calibrar no Search Console e numa ferramenta de volume). Página-alvo entre parênteses.

| Prioridade | Keyword | Intenção | Volume (est.) | Dificuldade (est.) | Página-alvo |
|---|---|---|---|---|---|
| P0 | chatbot com IA para WhatsApp | comercial | alto | alta | `/iza`, blog 5 |
| P0 | atendimento automatizado WhatsApp | comercial | alto | alta | `/solucoes/atender` |
| P0 | CRM no WhatsApp | comercial | médio | média | `/crm`, blog 4 |
| P0 | CRM integrado WhatsApp | comercial | médio | média | `/crm` |
| P0 | quanto custa a Zenvia | comparativo | médio | média | blog 1, `/comparativo` |
| P0 | quanto custa o Blip | comparativo | baixo | média | blog 2, `/comparativo` |
| P0 | WhatsApp API oficial preço | comercial | médio | média | `/precos`, blog 3 |
| P0 | ZappIQ preço / quanto custa ZappIQ | marca | baixo | baixa | `/precos` |
| P0 | plataforma de IA para WhatsApp | comercial | médio | alta | `/` (home) |
| P1 | disparo em massa WhatsApp | comercial | alto | alta | `/campanhas`, blog 7 |
| P1 | envio em massa WhatsApp | comercial | médio | alta | `/campanhas` |
| P1 | um número vários atendentes WhatsApp | inform/comercial | médio | média | blog 8, `/solucoes/atender` |
| P1 | agente de IA para vendas | comercial | médio | média | `/solucoes/vender`, blog 10 |
| P1 | qualificar leads com IA | comercial | baixo | média | `/solucoes/vender`, blog 9 |
| P1 | atendimento 24 horas WhatsApp | comercial | médio | média | `/solucoes/atender` |
| P1 | agendamento automático WhatsApp | comercial | médio | média | `/agendamento`, blog 12 |
| P1 | reativar clientes WhatsApp | comercial | baixo | baixa | `/solucoes/reativar-base`, blog 11 |
| P1 | migrar da Zenvia / migrar do Blip | comparativo | baixo | baixa | `/migracao-zenvia`, `/migracao-blip` |
| P1 | automação de atendimento WhatsApp com IA | comercial | médio | alta | `/maestro` |
| P2 | transcrição de áudio WhatsApp atendimento | inform | baixo | baixa | `/voz`, blog 16 |
| P2 | sugestão de resposta atendente IA | inform | baixo | baixa | `/iza` (Echo, validar backend) |
| P2 | funil de vendas WhatsApp | inform | médio | média | `/crm`, `/solucoes/organizar-e-medir` |
| P2 | LGPD atendimento WhatsApp / dados no Brasil | confiança | baixo | baixa | `/seguranca-lgpd`, blog 15 |
| P2 | métricas de atendimento WhatsApp | inform | baixo | baixa | `/radar` |
| P2 | IA que não alucina / auditoria de agente IA | inform | baixo | baixa | `/qualidade`, blog 17 |
| P2 | IA para clínicas / e-commerce / escolas WhatsApp | comercial | médio | média | `/segmentos/*` |

Regra: usar o termo do concorrente como âncora de SEO, virar o ângulo para as bandeiras ZappIQ. Não clonar as manchetes deles.

---

## 7. Roadmap de implementação em ondas

Impacto (Alto/Médio) x Esforço (Baixo/Médio/Alto). Ordem: maior impacto e menor esforço primeiro.

### Onda 0: quick wins de higiene técnica (esforço baixo, base limpa antes de tudo)

Estes itens corrigem defeitos que canibalizam a percepção de preço no Google, quebram rich results e desperdiçam crawl. Muitos são one-liners de código.

| # | Item | Impacto | Esforço |
|---|---|---|---|
| 0.1 | Remover `aggregateRating` fabricado (4,8 / 500) do `SoftwareApplication` | Alto | Baixo |
| 0.2 | Corrigir `AggregateOffer` para 247 a 1497 e unificar os dois `Organization` (um `foundingDate` só) | Alto | Baixo |
| 0.3 | Corrigir metadata de `/precos` (remover "Starter" e "R$ 197", usar Lite a Enterprise) | Alto | Baixo |
| 0.4 | Corrigir slugs do `sitemap.ts` (varejo/saude/servicos-b2b/educacao) e torná-lo dinâmico com `lastmod` | Alto | Baixo |
| 0.5 | Redirects 308: `/home`, `/privacy`, `/terms`, `/data-deletion`, `/observabilidade` | Alto | Baixo |
| 0.6 | Atualizar root metadata e `manifest.ts` para multicanal (Instagram, CRM, vendas); remover keyword "pulse ai" | Alto | Baixo |
| 0.7 | `<html lang="pt-BR">`, `metadataBase`, `og:locale pt_BR` | Médio | Baixo |
| 0.8 | Publicar `/llms.txt` na raiz | Médio | Baixo |
| 0.9 | Remover referências ao tier "Business" (SLA no Scale) em `/precos`, `/sla`, `/enterprise` | Médio | Baixo |
| 0.10 | Corrigir bugs de código do brief: destaque duplo (`highlight` só no Growth) e `trialDays` no Growth | Alto | Baixo |
| 0.11 | Corrigir razão social "ONZE E ONZE" para MACHIA nos legais e rodapé (bate com o schema) | Médio | Baixo |
| 0.12 | Varredura de travessão e de "chatbot"/"conversacional"/"pulse ai" na copy renderizada | Médio | Médio |

### Onda 1: reposicionamento da home (impacto alto, esforço baixo a médio)

| # | Item | Impacto | Esforço |
|---|---|---|---|
| 1.1 | Novo `title`, `meta description` e H1 da home (seção 1.1) | Alto | Baixo |
| 1.2 | Reescrever hero para promessa de desfecho com a Iza personificada (sem "chatbot", sem travessão) | Alto | Baixo |
| 1.3 | Faixa de bandeiras junto ao CTA (zero setup, mensalidade fixa dentro da franquia, 14 dias sem cartão) | Alto | Baixo |
| 1.4 | FAQPage com schema na home (perguntas de fit e billing) | Alto | Médio |
| 1.5 | `SoftwareApplication` + `WebSite` (SearchAction) na home, com dados reais | Médio | Baixo |
| 1.6 | OG próprio da home e imagens OG dinâmicas com `next/og` por template | Médio | Médio |
| 1.7 | Faixa de prova e logos (só números e logos reais e verificáveis) | Alto | Médio |
| 1.8 | Habilitar ISR/estático nas páginas de marketing (ganho de TTFB e LCP) | Alto | Médio |

### Onda 2: páginas de produto, solução e segmento (impacto alto, esforço médio)

| # | Item | Impacto | Esforço |
|---|---|---|---|
| 2.1 | Criar `/produtos` (hub) e religar o mega-menu (mata a âncora `#produtos` quebrada) | Alto | Médio |
| 2.2 | Criar páginas de produto: `/iza`, `/crm`, `/campanhas`, `/agendamento`, `/maestro`, `/radar`, `/qualidade`; tirar `/voz` da orfandade | Alto | Alto |
| 2.3 | Criar soluções por job: `/solucoes/atender`, `/vender`, `/reativar-base`, `/organizar-e-medir` | Alto | Alto |
| 2.4 | Criar hub `/segmentos` (hoje 404) e as 4 verticais com slug correto | Médio | Médio |
| 2.5 | On-page SEO por página (seção 1) + `BreadcrumbList` + `FAQPage` + `Service`/`Product` por página | Alto | Médio |
| 2.6 | Blocos de resposta direta (GEO) no topo de cada página nova | Médio | Baixo |
| 2.7 | Malha de links internos (hub para produto, solução para produto, produto para preço) | Alto | Médio |
| 2.8 | Corrigir OG de `/recursos` e demais páginas que caem no default | Médio | Baixo |

### Onda 3: SEO de conteúdo, GEO e captura de demanda (impacto alto, esforço alto, contínuo)

| # | Item | Impacto | Esforço |
|---|---|---|---|
| 3.1 | Publicar os posts P0 (pautas 1 a 6) com `BlogPosting` schema, autoria e data | Alto | Alto |
| 3.2 | Páginas de migração por concorrente: `/migracao-blip`, `/migracao-poli` (além da `/migracao-zenvia`) | Alto | Médio |
| 3.3 | Bloco de custo total transparente em `/comparativo`, substanciado (CDC e CONAR) | Alto | Médio |
| 3.4 | Posts P1 e P2, 2 a 3 por semana, seguindo os clusters | Médio | Alto |
| 3.5 | Listagens em diretórios de software pt-BR com NAP e categoria consistentes (GEO) | Médio | Médio |
| 3.6 | Faixa de confiança/LGPD e página `/seguranca-lgpd` (só claims verificados por engenharia e jurídico) | Médio | Alto |
| 3.7 | Demo interativa ungated ("Ver a Iza trabalhando") e medir o lift na própria home | Alto | Alto |
| 3.8 | Coleta de reviews reais com consentimento e ativação de `Review`/`AggregateRating` verdadeiros | Médio | Médio |

---

## 8. KPIs e como medir

O que já existe: **GTM** (container de tags) e **analytics** (GA4 via GTM presumido). Aproveitar os dois. Search Console já verificado.

### 8.1 Stack de medição (ligar o que faltar)

- **Google Search Console:** cobertura de indexação, consultas, impressões, CTR, posição média, e o relatório de aprimoramentos (rich results de FAQ, Breadcrumb, Product). Fonte primária de ranking.
- **Bing Webmaster Tools:** ligar (o Bing alimenta parte das respostas do Copilot e de LLMs).
- **GA4 via GTM:** eventos de conversão (início de trial, clique em CTA "Começar 14 dias grátis", clique em "Ver a Iza trabalhando", envio de `/agendar`, scroll de seção). Segmentar por canal `organic`.
- **Vercel Speed Insights e Web Analytics:** Core Web Vitals de campo (LCP, INP, CLS) por rota.
- **Validação de schema:** Rich Results Test e Schema Markup Validator em cada deploy que toca schema.
- **Rank tracking:** acompanhar as keywords P0 e P1 da seção 6 numa ferramenta (mesmo que semanal e manual no começo).
- **Tráfego de IA (GEO):** criar no GA4/GTM um segmento por `referrer` contendo `chatgpt.com`, `perplexity.ai`, `gemini.google.com`, `copilot.microsoft.com`, para medir sessões vindas de respostas de IA. Complementar com buscas manuais periódicas nesses assistentes ("qual a melhor plataforma de IA para WhatsApp", "quanto custa a Zenvia") para ver se a ZappIQ é citada.

### 8.2 KPIs por objetivo

| Objetivo | KPI primário | KPI de apoio | Meta inicial (calibrar) |
|---|---|---|---|
| Reposicionamento pega tração | ranking das keywords P0 (top 10) | impressões por consulta reposicionada (CRM, vendas, campanhas) | subir 3 keywords P0 ao top 10 em 90 dias |
| Captura de demanda orgânica | sessões orgânicas | páginas indexadas, CTR médio no SERP | crescimento mês a mês, baseline no mês 1 |
| Conversão orgânica | trials iniciados via orgânico | CTA clicado, taxa página para trial | definir baseline próprio, otimizar por A/B |
| Saúde técnica | Core Web Vitals verdes no p75 mobile | TTFB, cobertura sem erros no Search Console | LCP menor que 2,5s, INP menor que 200ms, CLS menor que 0,1 |
| Rich results | cobertura de FAQ/Breadcrumb/Product válidos | zero itens com erro no relatório de aprimoramentos | 100 por cento dos schemas válidos |
| GEO/AEO | citações da ZappIQ em respostas de IA | sessões com referrer de assistentes | presença crescente nas consultas-alvo |
| Conteúdo | posts publicados e no top 20 | tempo na página, links internos clicados | 6 posts P0 no trimestre |

### 8.3 Baseline e cadência

- **Antes de publicar a Onda 1**, registrar o baseline: sessões orgânicas, top consultas, CWV atuais, conversão home para trial. O reposicionamento troca o vocabulário-alvo, então o baseline evita conclusão errada sobre queda ou alta.
- **Cadência:** revisão semanal de rankings e CWV, revisão mensal de tráfego, conversão e cobertura de schema, revisão trimestral do mapa de keywords e das pautas.
- **Não usar** a mediana Unbounce (3,8 por cento) como meta de conversão da home: aquele benchmark é de landing de campanha com tráfego pago, não de home. Usar o baseline próprio.

---

## Guardrails finais (não violar)

1. Copy em pt-BR com acentuação completa, sem travessão. Voz piloto-instrutor: prova antes de promessa.
2. Números beta sempre rotulados como ilustrativos. Nunca como métrica de caso auditado.
3. Claims de fato com risco jurídico (Meta Business Partner, dados no Brasil, SLA 99,9 por cento, incidente 72h, comparativo nominal) só ao ar após engenharia e jurídico, com substanciação CDC e CONAR.
4. Sem `aggregateRating` ou `Review` no schema até haver avaliações reais e verificáveis.
5. "Agêntico" é higiene de categoria, não moat. O diferencial defensável é a combinação (amplitude multi-produto no ticket de PME, autonomia com aprovação, auto-correção auditada, CRM na origem, zero setup, mensalidade fixa, dados no Brasil).
6. "Mensalidade fixa sem cobrança por conversa" é verdade dentro da franquia (há overage cerca de R$ 0,03 por mensagem e passthrough Meta nos disparos). A copy e o schema não podem sugerir custo marginal zero.
7. Status honesto: o que é parcial (Echo Copilot runtime, Radar 360 BI preditivo) ou em construção (Loop de Receita do Impulso, Microsoft 365 no Agendamento, Maestro auto-otimização) entra como "em breve" ou fica fora do ar.
