# Auditoria especialista da nova home V6 (UX, CRO, SEO, copy, comercial)

Data: 11/07/2026
Alvo: nova home (reposicionamento V6), branch `landing/reposicionamento-v6`
Método: painel de 6 especialistas PhD (CRO, posicionamento, arquitetura de informação, SEO/GEO, copywriting, comercial), cada um lendo os arquivos reais, seguido de um lead que deduplicou, priorizou por ICE (impacto x confiança x facilidade) e montou o roadmap.

## Nota geral: 5,8 / 10

O problema não é de acabamento, é de higiene e encanamento. A categoria nova ("Operação Autônoma de Atendimento e Vendas") foi empilhada por cima da página antiga de chatbot em vez de substituí-la. Resultado: planos descontinuados (Business R$1.997, Starter) e a categoria velha ("IA conversacional", "pulse ai") vazam pelo FAQ, Pricing, SEO e schema. Pior, os dois CTAs de maior intenção estão quebrados (a calculadora aponta para `/register`, que dá 404, e o menu Produtos inteiro cai numa âncora inexistente), não há uma única prova de cliente na página toda, e no mobile o botão de trial some dentro do hambúrguer.

A boa notícia: a maioria dos vazamentos de receita é copy ou código reversível, que dá para corrigir sozinho. Sobram poucas decisões comerciais e jurídicas para o fundador.

### Notas por lente

| Lente | Nota |
|---|---|
| CRO / Resposta Direta | 5,5 |
| Posicionamento (April Dunford) | 6,0 |
| Arquitetura de Informação / UX | 5,5 |
| SEO técnico + GEO/AEO | 6,0 |
| Copywriting e Persuasão | 6,5 |
| Estratégia Comercial e Pricing | 5,5 |

## O que já está bom (preservar)

- **Headline-mãe do Hero e a diferenciação da JornadaLead** estão entre os melhores textos de SaaS B2B brasileiro: promessa (atende, vende, faz campanha) mais controle (você aprova, ela executa), com a linha "Não é um chatbot. É a sua operação rodando sozinha".
- **Oferta de entrada forte e consistente** entre Hero, Pricing, ROI e CTAFinal: 14 dias grátis, sem cartão, sem setup fee, cancela quando quiser, dados no Brasil.
- **Tabela de preços central correta** e derivada de fonte única (Lite 247, Growth 497 Mais Popular, Scale 1497, Enterprise sob consulta), com boa ancoragem.
- **Calculadora de ROI com metodologia honesta** (cap de 300%, payback mínimo de 90 dias, disclaimer) e o /diagnostico é uma máquina de qualificação bem construída.
- **Fundação técnica de SEO madura**: um único H1, outline de H2 limpo, sitemap/robots/manifest, canonical, Search Console, JSON-LD com faixa de preço correta. E zero travessão na página inteira (conformidade total com a voz MACHIA).

## Prioridades (ranqueadas por ICE)

Legenda: dono `autônomo` = mudança reversível de copy/código que eu executo; `fundador` = decisão comercial/jurídica.

### Fase 1 (quick wins reversíveis, autônomo)

1. **CTA da calculadora de ROI: 404 em /register + recomenda planos mortos** (crítica, CRO+comercial). No ponto de maior intenção, o botão usa `/register?plan=GROWTH` (rota inexistente, 404) e o motor recomenda Starter/Business (deprecados). Trocar para `/cadastro?plan=<id minúsculo>&utm_source=roi_calc` e o `tryOrder` para planos ativos.
2. **Purgar Business/Starter de toda a copy visível** (alta, 5 das 6 lentes). O comprador vê 4 planos na tabela mas lê respostas de FAQ sobre "Business R$1.997" e "Starter", mais callouts de Pricing/Trust/Footer/Mira. Find/replace: Starter->Lite, Business->Scale; reescrever grupo Planos do FAQ; remover constantes mortas; puxar tudo de `listActivePlans`.
3. **Deep-link de plano quebrado: todo CTA cai no Lite** (alta, comercial). Quem clica em Growth ou Scale, ou recebe recomendação do /diagnostico, chega no wizard com Lite marcado (o Cadastro não lê `?plan` no mount, e o diagnostico emite `?plano=lite` enquanto o Cadastro lê `?plan=iza_lite`). Ler `?plan` no mount, normalizar e padronizar todos os CTAs.
4. **Menu Produtos inteiro cai em âncora morta #produtos** (crítica, CRO+UX). Item nº 1 do nav, 8 cards do mega, "Ver todos os módulos" e 8 links do rodapé apontam para `#produtos`, id que só existe em `Products.tsx` (não renderizado). Repontar para âncoras reais.
5. **Reescrever SEO head + schema para a nova categoria; remover "pulse ai"** (alta, SEO+posicionamento). Title/description ainda dizem "IA para WhatsApp sem setup fee" / "IA conversacional" (categoria antiga) e keywords têm "pulse ai" (codinome proibido). Novo title, description e keywords focados em operação autônoma; padronizar a descrição em todos os nós de schema e no manifest.
6. **Escassez com prazo vencido + oferta contraditória do Programa Fundadores** (média, copy+CRO). O bloco usa deadline 30/06/2026 (já passou) e o toast anuncia "50% off no 1º ano" enquanto o bloco diz "30% vitalício". Trocar por gatilho de quantidade e alinhar a oferta vigente.
7. **CTA de trial sticky no mobile** (alta, CRO). No mobile o único "Começar 14 dias grátis" fica dentro do hambúrguer. Adicionar barra sticky no rodapé mobile.
8. **scroll-padding-top + prefers-reduced-motion no CSS global** (média, UX+SEO). Sem `scroll-padding-top`, todo clique em âncora para com o título escondido atrás da navbar. E ~20 keyframes rodando infinite sem respeitar `prefers-reduced-motion` ferem WCAG e degradam INP/bateria no mobile.
9. **Reescrever HowItWorks e AgentQualityProactive, que reinstalam a categoria "chatbot"** (alta, posicionamento). HowItWorks reduz a operação a "conecte um bot, alimente FAQ, resolve 65% dos tickets" (KPI de deflection), e AgentQuality se autodenomina "a primeira IA conversacional" e "única do mundo". Reescrever para a lógica aprova/executa e suavizar o claim.
10. **Headline quebrado do card-herói "Por que ZappIQ"** (média, copy+posicionamento). O maior card do bento tem h3 agramatical que avisa que a Iza pode ser renomeada, fraturando a persona única. Substituir por um texto de canal único (WhatsApp e Instagram, um agente só).
11. **Padronizar gênero da marca, preço do Lite e variar CTAs** (baixa, copy+comercial). O FAQ oscila entre "o ZappIQ" e "a ZappIQ"; o Lite aparece como R$249,90 no wizard vs R$247 no resto; "Começar 14 dias grátis" se repete idêntico 5x. Padronizar e variar CTAs por contexto. Renomear `STARTER_PRICE` (fallback 197 é bomba-relógio).

### Fase 2 (estrutural)

12. **Emitir FAQPage JSON-LD** (depois de corrigir os nomes de plano, para não propagar planos mortos aos motores de IA). A home tem 37 pares pergunta/resposta, insumo ideal para rich result e citação por IA.
13. **Curar a página de 20 para ~12 blocos**: a autonomia é contada 3x (PlataformaAutonoma, JornadaLead, MaestroSection, AgentQuality repetem a mesma tese e exemplos). Organizar em 5 atos, subir o Pricing, cortar deep-dives para páginas de produto.
14. **Alinhar mega-menu e labels aos nomes canônicos do Dash** (Conversas, Zap Impulso, Maestro, Analytics...), adicionar Mira Prospects e Voz Nativa, renomear "Empresa".
15. **Reduzir excesso de overlays no primeiro contato**: banner Meta + popup Meta (duplicados) + balão WhatsApp + toast + exit-intent competindo com o CTA.
16. **Levar o /diagnostico para perto do Pricing** e apontar o CTA secundário do Hero ("Ver a Iza trabalhando") para /demo.
17. **Ancorar termos de busca (WhatsApp/Instagram) nos eyebrows** e reativar cache/ISR da home (hoje roda `force-dynamic` só para ler `LAUNCH_MODE`, desligando cache de borda).
18. **Consolidar Organization JSON-LD duplicado** (dois nós contraditórios) e enriquecer schema (WebSite+SearchAction, BreadcrumbList, Product/Offer por plano), sitemap dinâmico, links internos.

### Fase 3 (estratégico)

- Faixa de prova real de cliente perto do Pricing e CTAFinal (depende de autorização do fundador).
- Rota /produtos dedicada e páginas de produto para os deep-dives cortados.
- Testar default do toggle de pricing em Anual.
- Micro-garantia de satisfação de 30 dias para planos pagos.
- OG dinâmico por rota via next/og e bloco factual citável por IA (GEO).
- Experimento A/B da home nova vs V6 atual.

## Decisões que dependem do fundador

1. **Prova de cliente**: quais clientes/pilotos podemos citar com nome, empresa e número, e quem autoriza? Sem isso o maior vazamento estrutural fica bloqueado. Alternativa: autorizar um mini-case de dogfooding da própria Iza com métrica verificável.
2. **Claim "Meta Business Partner"**: o Hero afirma isso e o PorQueZappIQ diz "parceria direta com a META, sem atravessador", mas o código usa "BSP homologado via 360Dialog" (intermediário, nome proibido). Validar o tier real com a Meta. Se não confirmado, aprovar o fallback "Conexão oficial via Meta Cloud API".
3. **Política de bundling da Mira Prospects**: hoje a copy diz "add-on no Growth e Scale, incluído no Business e Enterprise" (contraditório e cita Business morto). Precisa de regra única.
4. **Motion do plano Scale**: sales-led (sem trial, vai para /agendar) ou self-serve com trial de 14 dias? O código diz uma coisa e a copy diz outra.
5. **Comparação com concorrente na calculadora**: manter os números (R$8.000 setup, 80% mais caro) com base pública nomeada, ou suavizar para claim genérico sem risco de publicidade comparativa?
6. **Faixa exata do SLA 99,9% e do Enterprise** (sob consulta / a partir de R$9.900): confirmar antes de publicar no FAQ.
7. **Toggle de pricing default em Anual** e **micro-garantia de 30 dias**: decisões de caixa/política.

## KPIs para medir a nova home

- Taxa de clique dos CTAs de trial (Hero, Pricing, ROI) e taxa de 404 pós-clique (deve ir a zero).
- Conversão visitante -> início de cadastro e visitante -> trial ativado.
- Distribuição de plano no cadastro: % Growth+Scale vs Lite (mede o efeito do deep-link no ticket médio).
- Conversão mobile específica antes/depois da barra sticky.
- Scroll depth médio e abandono antes do Pricing (mede a curadoria de blocos).
- Conclusão do /diagnostico e conversão diagnostico -> cadastro com plano preservado.
- CTR orgânico e impressões no Search Console para "agente de ia whatsapp" e "ia que vende no whatsapp".
- Rich result de FAQPage e citações da ZappIQ com a nova categoria em motores de IA.
- Core Web Vitals (LCP e INP) antes/depois do cache e do prefers-reduced-motion.
- Conversão trial -> pago e ticket médio de entrada.
