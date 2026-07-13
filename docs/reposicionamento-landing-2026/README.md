# Reposicionamento da landing ZappIQ, 2026

Plano completo para reposicionar a landing zappiq.com.br de "plataforma de IA conversacional para WhatsApp" para o que a plataforma de fato já é: uma operação de atendimento, vendas e campanhas que roda sozinha, com CRM que se preenche na origem e você aprovando.

Base de evidência: código real de julho de 2026 no monorepo `~/zappiq-main` (`apps/web`, `apps/api`, `packages/shared/src/planConfig.ts`, `Sidebar.tsx`), auditoria da landing atual e do site live, e pesquisa verificada de melhores práticas (posicionamento agêntico, CRO, SEO/GEO, pricing, concorrentes BR).

## O diagnóstico em uma frase

O site diz "atende". O código faz "atende, vende, faz campanha, organiza o CRM, agenda e se audita sozinho". A landing está vendendo o produto que a ZappIQ era, num mercado em que o produto que ela é não tem concorrente direto no ticket de PME. Ao se chamar de "chatbot de WhatsApp", ela se compara com Blip, Zenvia e Poli pelo eixo errado (preço por conversa) e esconde o que tem de único (CRM que se preenche sozinho, receita atribuída à IA, campanhas montadas por IA, agendamento por tools, loop de auto-correção auditada).

## A proposta

- **Categoria:** liderar uma subcategoria própria, "Operação Autônoma de Atendimento e Vendas".
- **Mensagem-mãe:** "A Iza atende, vende e faz campanha pela sua operação, no WhatsApp e no Instagram. Você aprova, ela executa, o resultado aparece no painel."
- **Seis pilares:** Atendimento que resolve, Vendas que a IA fecha e prova, Campanhas que vendem pela base, CRM que se preenche sozinho, Agenda cheia sem secretária, Confiança auditável.
- **A narrativa que costura tudo:** a jornada de um lead do anúncio à receita, sem você tocar, mostrando Iza, CRM, Maestro, Agenda, Atribuição, Zap Impulso e Pulso como uma operação só, não uma lista de features.

## Os documentos

| Arquivo | O que é |
|---|---|
| `00-pesquisa-melhores-praticas.md` | Pesquisa verificada e citada: posicionamento agêntico global, CRO de home multi-produto, SEO/GEO, pricing e teardown dos concorrentes BR |
| `01-estrategia-reposicionamento.md` | A estratégia (método April Dunford): diagnóstico, nova categoria, mensagem-mãe, seis pilares, jornada do lead, nova arquitetura de informação do site, nova ordem da home |
| `02-blueprint-paginas-e-copy.md` | Copy pronta pra colar: home em 18 seções mais os esqueletos de /produtos, páginas por produto, /solucoes, /precos e /comparativo |
| `03-seo-e-implementacao.md` | SEO on-page por página, dados estruturados (JSON-LD), SEO técnico, GEO/AEO, clusters de conteúdo, mapa de keywords pt-BR, roadmap em 4 ondas e KPIs |
| `04-catalogo-produtos.md` | O catálogo marketeiro de produtos: um bloco profundo por produto (valor, diferencial, alto impacto, integração), com os nomes do Dash, mais tabelas de plano e de add-ons |
| `produtos/01-iza.md` a `produtos/12-governanca.md` | Os 12 dossiês de produto na íntegra (fonte do catálogo) |
| `_fatos-canonicos.md` | A folha de fatos canônicos extraída do código: planos, preços, limites, add-ons, status por módulo. É o gabarito e a semente da skill de fonte de verdade |
| `AUDITORIA-consistencia.md` | O relatório da auditoria de consistência: 78 correções aplicadas, o que foi verificado e a nota de confiança |
| `DECISOES-PARA-O-FUNDADOR.md` | As 15 decisões que dependem de você antes de publicar (jurídico, status de deploy, precificação) |
| `SKILLS-RECOMENDADAS.md` | A recomendação de skills para manter a landing informada e marketeira, incluindo criar a skill de fonte de verdade `zappiq-landing` |

## Nomenclatura (fonte de verdade: Sidebar do Dash)

Produtos cliente-facing: Conversas, Contatos, CRM, Agenda, Tarefas, Zap Impulso, Templates, Maestro, Analytics, Treinar IA, Qualidade da IA, Auditoria, Requisições LGPD. Agente = Iza. Add-ons: Voz Nativa, Radar 360. Os codinomes em inglês (ZappIQ Core, Pulse AI, Spark Campaigns, Radar Insights, Nexus CRM, ForgeStudio, Echo Copilot como marca-mãe, ShieldCompliance) são antigos e não aparecem no material.

## Status e prontidão

- **Base factual da plataforma (o que faz, quanto custa, como se chama):** verificada contra o código, confiança 9/10. Planos ativos Lite R$ 247, Growth R$ 497, Scale R$ 1.497, Enterprise sob consulta. Starter e Business descontinuados.
- **Higiene de copy:** zero travessão, zero codinome antigo como marca, zero hype proibido, status honesto por recurso (parcial e "em breve" marcados).
- **Bloqueio para publicar:** 15 decisões suas (ver `DECISOES-PARA-O-FUNDADOR.md`), das quais 8 são claims de fato com risco jurídico já marcados `[confirmar]` (Meta Business Partner, dados no Brasil, SLA, comparativos nominais). Nada com `[confirmar]` vai ao ar sem sign-off.

## Como implementar (ordem sugerida)

1. **Onda 0, higiene técnica** (esforço baixo, ver `03`): remover o `aggregateRating` fabricado, corrigir a metadata de /precos que ainda cita Starter R$ 197, corrigir a razão social "ONZE E ONZE", slugs de segmento com 404, redirects e âncora `#produtos` quebrada.
2. **Onda 1, reposicionamento da home**: nova hero, faixa de bandeiras, FAQ com schema, usando só os claims já verdadeiros.
3. **Onda 2, páginas de produto, solução e segmento**: criar /produtos e as páginas por produto (o maior gap do site hoje), religando o mega-menu.
4. **Onda 3, SEO de conteúdo e GEO**: posts P0, páginas de migração por concorrente, hub de confiança.

Em paralelo: despachar as decisões do bloco A (jurídico) para liberar as páginas de confiança, e resolver o item 9 (status do Google Calendar), que pode estar subvendendo capacidade real.

Gerado em 10/07/2026.
