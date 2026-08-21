## nome

ZappIQ Resolve: mensalidade fixa por atendimento resolvido (a tarifa da Meta a custo, na conta do cliente, com medidor e teto)

## tese

Em 1º de outubro toda resposta no WhatsApp vira custo por mensagem. Quem vende franquia de mensagens terá de escolher entre absorver a tarifa e sangrar margem ou repassar escondido e queimar confiança. O ZappIQ Resolve troca a unidade de valor: mensalidade fixa por atendimentos resolvidos pela IA, com mensagens ilimitadas dentro de cada atendimento. A tarifa da Meta não entra no nosso preço: no modelo Tech Provider ela já nasce na conta Meta do cliente, e é repassada a custo, com medidor em tempo real, projeção de fatura, teto configurável e modo econômico que reduz mensagens por atendimento. A margem bruta fica imune a qualquer reajuste da Meta, a previsibilidade do dono de PME é preservada, pois o boleto máximo é o plano mais o teto que ele mesmo definiu, e o discurso muda de patamar: cobramos pelo problema resolvido, provado em extrato auditado.

## tabela_planos

## Planos ZappIQ Resolve (novos clientes a partir de 22/09/2026; base migra a partir de 01/11/2026)

| Item | Essencial (novo) | Lite | Growth | Scale | Enterprise |
|---|---|---|---|---|---|
| Mensalidade | R$ 147 | R$ 247 | R$ 497 | R$ 1.497 | sob consulta |
| Anual (20% off) | R$ 117,60/mês | R$ 197,60/mês | R$ 397,60/mês | R$ 1.197,60/mês | contrato |
| Atendimentos resolvidos pela IA/mês (todos os canais: WhatsApp, Instagram, webchat) | 150 | 250 | 500 | 1.500 | volume negociado |
| Mensagens dentro de cada atendimento | Ilimitadas | Ilimitadas | Ilimitadas | Ilimitadas | Ilimitadas |
| Atendimento excedente (opcional, medido, com teto) | R$ 1,90 | R$ 1,70 | R$ 1,40 | R$ 1,10 | atacado |
| Teto de excedente padrão (configurável) | Desligado | Desligado | 30% da mensalidade | 30% da mensalidade | contrato |
| Disparos inclusos (campanhas, cobrados por mensagem) | 100 | 200 | 5.000 | 60.000 | negociado |
| Atendentes humanos | 1 | 2 | 10 | 75 | custom |
| Contatos | 500 | 1.000 | 10.000 | 200.000 | custom |
| Fluxos Maestro | 1 | 3 | 15 | Ilimitados | custom |
| Canais | WhatsApp + webchat | + Instagram Direct | Todos | Todos | Todos |
| Tarifa Meta | A custo, zero markup, paga direto na conta Meta do cliente, com Medidor Meta, projeção de fatura e teto com auto-pausa | idem | idem | idem | idem |
| Extrato de atendimentos com transcrição, contestação em 1 clique e crédito automático da auditoria | Sim | Sim | Sim | Sim | Sim |
| Trial | 14 dias sem cartão, 50 atendimentos | idem | idem | idem | POC |
| Setup | R$ 0 | R$ 0 | R$ 0 | R$ 0 | R$ 0 |
| LGPD, dados no Brasil | Sim | Sim | Sim | Sim | Sim + SLA 99,9% e DPA dedicado |

**Packs avulsos** (sem assinatura extra): 100 atendimentos por R$ 159 ou 500 por R$ 649 (validade 90 dias); 1.000 disparos por R$ 49 ou 10.000 por R$ 349 (tarifa Meta da campanha exibida antes do envio pelo estimador).

**Cohort Founders (intocável)**: 30% de desconto vitalício sobre a tabela nova (Essencial R$ 102,90, Lite R$ 172,90, Growth R$ 347,90, Scale R$ 1.047,90), franquia de atendimentos 30% maior vitalícia (195/325/650/1.950) e excedente também com 30% off (R$ 1,33/1,19/0,98/0,77).

**Partner white-label (Q1 2027)**: parceiro compra atendimentos no atacado (R$ 0,90 a 1,10) e revende com markup próprio; na nova estrutura de conta da Meta (termos de 23/09/2026), cada parceiro tem Messaging Account e cobrança separadas no mesmo número, e a tarifa Meta segue indo direto ao cliente final.

## A unidade: o que conta como atendimento resolvido

**Conta 1 atendimento** quando a IA respondeu ao contato e a conversa terminou (a) com objetivo cumprido (agendamento feito, pedido registrado, dúvida respondida com confirmação ou encerramento natural) ou (b) por silêncio: 24h sem resposta do contato após a última mensagem da IA, com carência de 72h (se o contato voltar ao mesmo assunto em até 72h, reabre o MESMO atendimento, não conta outro).

**Não conta (não consome franquia)**: conversa transbordada para humano (por pedido, intenção ou regra do Maestro) é atendimento assistido e sai grátis; mensagens de fluxo determinístico do Maestro (menus, botões, confirmações); contato que só manda "ok" ou emoji sem diálogo; conversas de teste do próprio dono; atendimento marcado como ruim pelo loop de auto-correção auditada (crédito automático, sem o cliente pedir).

**Anti-disputa (a lição do Intercom Fin, que cobra silêncio de 24h e vive brigando)**: carência de 72h para reabertura; máximo de 1 atendimento cobrado por contato por dia; extrato com link para cada transcrição e motivo do fechamento; contestação em 1 clique com 30 dias de prazo e crédito imediato quando procedente; e a nossa auditoria de IA (diferencial já existente) atua como árbitro automático a favor do cliente.

**Ao esgotar a franquia**: avisos em 70/90/100%; depois, ou o excedente medido roda até o teto que o cliente definiu, ou (teto desligado) a operação entra em modo assistido: fluxos determinísticos do Maestro continuam, atendimento humano continua, e o upgrade é feito em 1 clique. A IA nunca some sem aviso e o boleto nunca passa de plano + teto.

## unit_economics

## Conta aberta (premissas medidas em produção, 20/08/2026)

- 1 resposta da IA = 1,12 balões; 1 atendimento resolvido = 5 respostas da IA = ~5,6 mensagens de serviço cobráveis pela Meta (dados reais: 5,4 balões outbound por conversa; amostra pequena, recalibrar na sombra de setembro).
- Custo variável ZappIQ por atendimento: LLM R$ 0,37 (mix com auditoria amostral) + infra R$ 0,05 + TTS R$ 0,03 = **R$ 0,45 no cenário base** (hoje, sem roteamento de modelo: ~R$ 0,60; otimizado com Haiku em turnos simples + cache: ~R$ 0,30). Derivado do custo real medido de US$ 0,0134 por chamada LLM (llm_call_logs).
- Stripe: 3,5% da receita. Câmbio: R$ 5,45/US$.
- Cenários de tarifa Meta por mensagem de serviço: **A** R$ 0,02 (otimista), **B** R$ 0,035 (referência confirmada: tarifa utility BR vigente), **C** R$ 0,08 (estresse: câmbio + reajuste).

**O ponto estrutural**: no modelo Tech Provider, a WABA, a forma de pagamento e a fatura Meta são do cliente (confirmado na auditoria do repo: zero linha de crédito ou on-behalf billing). Custo de tarifa Meta no COGS da ZappIQ: **R$ 0,00 nos três cenários**. A margem abaixo é idêntica em A, B e C. Essa é a imunização.

## Margem bruta ZappIQ por plano (invariante à tarifa Meta)

| Plano | Receita | Custo var. franquia CHEIA | Stripe | Margem cheia | Custo var. uso típico (40%) | Margem no uso típico |
|---|---|---|---|---|---|---|
| Essencial (150 at.) | R$ 147 | R$ 67,50 | R$ 5,15 | 50,6% | R$ 27,00 | 78,1% |
| Lite (250 at.) | R$ 247 | R$ 112,50 | R$ 8,65 | 50,9% | R$ 45,00 | 78,3% |
| Growth (500 at.) | R$ 497 | R$ 225,00 | R$ 17,40 | 51,2% | R$ 90,00 | 78,4% |
| Scale (1.500 at.) | R$ 1.497 | R$ 675,00 | R$ 52,40 | 51,4% | R$ 270,00 | 78,5% |

Excedente: margem de 76% (Essencial, R$ 1,90) a 59% (Scale, R$ 1,10). **Blend projetado da plataforma (utilização média 35 a 50% + excedentes): 74 a 79%, acima da meta de 70%.** Pior caso teórico absoluto (todas as franquias 100% usadas): 51%, nunca negativo. Contraste com o modelo atual: Growth cheio custaria ~R$ 720 de LLM sobre R$ 497 e Scale cheio ~R$ 7.200 sobre R$ 1.497, ambos deficitários antes de qualquer tarifa Meta. O Resolve conserta isso.

**Sensibilidade ao custo LLM (Growth)**: a R$ 0,30/atendimento, margem cheia 66% e típica 84%; a R$ 0,45, 51% e 78%; a R$ 0,60 (custo atual sem otimização), 36% e 72%. O roteamento de modelo é, portanto, mudança de produto obrigatória, não opcional.

## Fatura Meta do cliente (paga direto à Meta, visível no Medidor)

| Plano (franquia cheia) | Msgs de serviço/mês (~5,6 por at.) | Cenário A (R$ 0,02) | Cenário B (R$ 0,035) | Cenário C (R$ 0,08) |
|---|---|---|---|---|
| Essencial | 840 | R$ 16,80 | R$ 29,40 | R$ 67,20 |
| Lite | 1.400 | R$ 28,00 | R$ 49,00 | R$ 112,00 |
| Growth | 2.800 | R$ 56,00 | R$ 98,00 | R$ 224,00 |
| Scale | 8.400 | R$ 168,00 | R$ 294,00 | R$ 672,00 |

No cenário B, a tarifa Meta é ~16% do custo total do cliente na franquia cheia e 6 a 8% no uso típico. Mensagens na janela de 72h de anúncio clique-para-WhatsApp seguem grátis, então quem faz tráfego pago paga ainda menos (e o Meta Business Agent cobra token ATÉ nessa janela). A fatura Meta inclui também as mensagens dos atendimentos assistidos por humanos; o Medidor mostra tudo, projeta o mês e pausa campanhas no teto.

## Custo total por atendimento resolvido (cenário B, franquia cheia)

| Solução | Custo por atendimento |
|---|---|
| ZappIQ (plano + tarifa Meta) | **R$ 1,18 a 1,19** em todos os planos, com CRM, agenda, campanhas, humano e auditoria |
| Meta Business Agent (só o token, sem plataforma, sem CRM, sem campanha) | R$ 1,23 a 1,50 |
| Intercom Fin (por resolução) | ~R$ 5,40 |

O atendimento resolvido da ZappIQ, com a plataforma inteira e a tarifa Meta somada, custa menos que o token cru do agente da própria Meta.

## Disparos (campanhas) continuam por mensagem

Franquia por plano + packs. A tarifa Meta de marketing (R$ 0,3217/msg) é sempre do cliente e aparece ANTES do envio: uma campanha Growth de 5.000 disparos mostra "custo Meta estimado: R$ 1.608,50" na tela de confirmação. Custo ZappIQ por disparo é infra desprezível: margem preservada.

## Resposta à pergunta obrigatória: a tarifa Meta entra no preço da resolução?

**Não. É repassada à parte, a custo, na conta Meta do próprio cliente.** Três razões: (1) arquitetura: como Tech Provider, a ZappIQ nem pode pagar a Meta pelo cliente (linha de crédito compartilhada é exclusiva de Solution Partner); (2) margem: embutir dolarizaria o COGS e cada câmbio ou reajuste da Meta comeria a margem, que hoje fica imune por construção; (3) posicionamento: separar com zero markup vira bandeira de transparência (padrão 360dialog) contra quem embute com gordura (Twilio +US$ 0,005/msg, Wati ~20%, Blip em pacote fechado). A previsibilidade que a mensalidade fixa prometia é preservada pelo trio Medidor + projeção + teto e pela migração assistida da WABA para faturamento em BRL pela Facebook Brasil (prazo final 30/06/2027).

## mudancas_produto

- Ledger de custo Meta: capturar o objeto pricing/billable/category dos webhooks de status, hoje descartado (campaignStatus.util.ts e whatsappService.ts), e gravar custo por mensagem, conversa, campanha e org. Esforço P (3 a 5 dias). Pré-requisito de tudo; no ar antes de 01/10.
- Medidor Meta no dashboard: custo em tempo real, projeção de fatura do mês, alertas em 70/90/100% e teto com auto-pausa de campanhas, reaproveitando hardCeilingBrl e a malha de alertas existente. Esforço M (1 a 2 semanas). No ar em 01/10 junto com a virada da Meta.
- Motor de Resolução: evento conversation.resolved com estados (resolvida confirmada, resolvida por silêncio de 24h com carência de reabertura de 72h, assistida por humano, abandonada), dedupe de 1 atendimento por contato por dia e vínculo com a transcrição. Base existente: conversationsAiResolved e closedAt em TenantUsageMonthly. Roda em sombra desde setembro, sem cobrar. Esforço M (2 a 3 semanas).
- Extrato de atendimentos: lista auditável com transcrição, motivo do fechamento, contestação em 1 clique (30 dias) e crédito automático; o loop de auto-correção auditada marca atendimento ruim e estorna sozinho, virando árbitro comercial. Esforço M.
- Billing por resolução no Stripe: novo meter resolucao_excedente com prices por plano, teto configurável, preview de fatura e packs; mecânica idempotente já provada no quotaOverageService (o meter de AI_MSG dormente vira referência). Flipar QUOTA_OVERAGE_MODE para enforce apenas no medidor novo, com kill switch. Esforço M.
- Roteamento de modelo por complexidade do turno (Haiku nos simples, Sonnet nos demais) + cache de FAQ, para levar o custo por atendimento de R$ 0,60 para R$ 0,45 e depois R$ 0,30. Esforço M. É o que sustenta a margem de 70%; sem isso, a margem típica cai ~6 pontos.
- Painel MPR (mensagens por atendimento) + Modo Econômico: resposta em 1 balão, encerramento com resumo, compactação de turnos; métrica comparativa no dashboard (seu MPR 4,2 contra 6,1 do mercado) que reduz a fatura Meta do cliente e vira prova de valor. Esforço P/M.
- Estimador de custo Meta pré-campanha e relatório pós-campanha (tarifa por categoria x destinatários), matando o susto do disparo. Esforço P.
- Migração do Embedded Signup v3 para v4 até 15/10/2026 (extras em ConectarCanais.tsx + nova configuração no painel Meta + validação de Advanced Access). Esforço P em código, mais dependência externa do painel.
- Assistente de faturamento BRL: wizard orientando o cliente a definir país de venda Brasil e migrar a WABA para fatura em reais da Facebook Brasil (prazo final 30/06/2027), removendo a fricção do dólar. Esforço P.
- Fair use e degradação elegante: ao esgotar a franquia sem excedente ligado, modo assistido (fluxos determinísticos do Maestro + fila humana) com upgrade em 1 clique; ligar o enforcement de disparos (enforceLimit hoje não tem nenhum caller). Esforço M.
- Identidade BSUID/usernames: phone nullable + coluna bsuid única por org + roteador de identidade no webhook (padrão ig:igsid já provado); 37 arquivos tocam phone. Esforço M. Necessário para contatos sem telefone no rollout de usernames da Meta.
- Monitor de saúde de WABA: quality_rating em cron multi-org com histórico e alertas (P); depois, webhooks account_update e phone_number_quality_update (M). Protege o ativo que gera as resoluções.
- Fase Partner white-label (Q1 2027): modelo Channel/Integration multi-número (hoje o schema só modela 1 número por org), wallet de atacado de resoluções com markup configurável do parceiro e aderência à nova estrutura da Meta (Messaging Account por parceiro, termos de 23/09). Esforço G (4 a 8 semanas). O atendimento resolvido é a unidade perfeita de rebilling: o parceiro compra a R$ 0,90 a 1,10 e revende a 2 a 3x, estilo Stammer/GoHighLevel, sem a ZappIQ tocar na tarifa Meta.
- Copy e site: substituir a bandeira 'mensalidade fixa sem cobrança por conversa' por 'mensalidade fixa por atendimento resolvido; tarifa Meta a custo, com medidor e teto' antes de 01/09, quando a Meta publica a tabela e a concorrência acorda. Esforço P.

## migracao_base

Ponto de partida real: 15 orgs, das quais 11 são seed sem uso (limpar o MRR fantasma antes de qualquer relatório), 1 cliente pagante (Growth anual, usa só webchat, zero WhatsApp) e o cohort Founders. Princípio da migração: ninguém paga mais pelo que já faz hoje, e ninguém perde acesso a nada que usa. Calendário: até 01/09, comunicado 1 (o que a Meta muda em outubro, o que a ZappIQ fará: medidor, teto, zero markup; seu preço não muda agora) e o Motor de Resolução entra em sombra medindo os atendimentos reais de cada conta sem cobrar nada. Em 01/09, quando a Meta publicar a tarifa oficial de serviço, o simulador individual é atualizado e cada cliente recebe a projeção da própria fatura Meta. Em 22/09, os planos Resolve entram no site para clientes novos. Em 01/10, Medidor Meta no ar para toda a base (a fatura da Meta chega para eles de qualquer jeito; quem avisa e mede somos nós). Em 01/11, virada da base mensal na renovação; anuais só na renovação do contrato. Trilho de equivalência: cada conta migra com franquia pessoal igual ao maior entre a franquia do plano novo e 1,5x a média de atendimentos resolvidos dos últimos 3 meses medida na sombra, travada por 12 meses. Garantia de não surpresa por 90 dias: se o boleto no modelo novo der maior do que daria no antigo, cobramos o menor. Founders: o desconto de 30% vitalício é preservado sobre a tabela nova (nunca expira, está no contrato e na honra), com franquia de atendimentos 30% maior vitalícia e excedente também com 30% off; carta pessoal do fundador explicando a mudança da Meta e selo Founders no painel. Como a unidade nova cobre com folga o uso real do cohort, nenhum Founder perde capacidade na prática; quem se sentir prejudicado cai na garantia de 90 dias. O cliente Growth anual pago até jul/2027 não muda nada até a renovação; como o uso dele é webchat, a tarifa Meta não o atinge e o impacto é zero. Contratos: aditivo simples com a definição objetiva de atendimento resolvido, direito de contestação de 30 dias, teto de excedente configurável e a declaração de que a tarifa Meta é paga pelo cliente diretamente à Meta, com a ZappIQ fornecendo medição e projeção. Nada de mudança retroativa: cobrança por resolução só começa depois de 30 a 60 dias de extrato em sombra que o cliente pode conferir.

## narrativa_vendas

O momento: a partir de 01/10/2026 a Meta cobra cada resposta no WhatsApp, de qualquer plataforma, de qualquer concorrente. Não existe mais fornecedor sem custo por mensagem; existe quem esconde a tarifa e quem te protege dela. Pitch de 20 segundos: "Você paga uma mensalidade fixa por atendimentos resolvidos pela IA, com quantas mensagens forem necessárias dentro de cada atendimento. A tarifa da Meta vai direto da Meta para você, a custo, sem markup, com medidor, projeção e teto dentro do ZappIQ. Sai cerca de R$ 1,20 por atendimento resolvido, tudo incluído, e atendimento que transborda para o seu time não é cobrado." Contra o Blip Go com Claro (R$ 179,90 a 399,90 na fatura do celular): é o plano de celular do atendimento, IA rasa, CRM Light, 50 a 300 disparos, e a tarifa de outubro vai bater lá também, embutida como reajuste ou repassada como surpresa; o Essencial a R$ 147 e o Lite a R$ 247 entregam IA que resolve e agenda, CRM completo, auditoria com crédito automático e o custo Meta às claras. Contra a Zenvia: plataforma vendida a pedaços (plano de R$ 600 a 3.900, mais pacote de canal de R$ 100 a 2.000, mais setup de R$ 649); a resposta deles para outubro foi um blog mandando o cliente escrever menos; a nossa é um motor que resolve em menos mensagens e mostra a economia no painel MPR. Contra o GPT Maker: crédito é ficha de fliperama, você paga a tentativa, resolvendo ou não; nós cobramos o resolvido, com extrato, transcrição e contestação em 1 clique. Contra o Meta Business Agent: é grátis de mensalidade e caro de token: R$ 1,23 a 1,50 por atendimento só de token, cobrado até dentro da janela de anúncio, exigindo linha de crédito na Meta, sem CRM, sem campanha, sem transbordo para o seu time, com seus dados na Meta e não numa empresa brasileira sob LGPDA. A isenção de tarifa de serviço que ele ganha vale uns R$ 0,20 por atendimento; o token dele custa R$ 1,20 ou mais: a conta não fecha, e o nosso atendimento completo custa menos que o token cru deles. Objeção "mas antes eram 8.000 mensagens": mensagem nunca foi valor; 500 atendimentos resolvidos são ~2.800 mensagens de conversa de verdade, e as mensagens dentro do atendimento agora são ilimitadas: ninguém corta a conversa no meio por causa de franquia. Objeção "vou pagar Meta por fora, isso é pegadinha?": pegadinha é embutir dólar com gordura; nós mostramos a tarifa antes, durante e depois, com teto que você controla, e ajudamos a migrar sua conta para fatura em reais da Facebook Brasil. Campanha de lançamento em setembro: "Outubro sem susto", com simulador público da fatura Meta por segmento, garantia de não surpresa de 90 dias e a promessa auditável: boleto máximo = plano + teto que você definiu.

## riscos

- Disputa sobre o que é resolução (a doença do Intercom Fin): mitigada com carência de 72h, 1 atendimento por contato por dia, extrato com transcrição, contestação em 1 clique e crédito automático da auditoria; monitorar taxa de contestação com gatilho de revisão da régua se passar de 2%.
- Custo LLM por atendimento acima de R$ 0,45 (conversas longas, áudio pesado, verticais tagarelas): o roteamento de modelo é obrigatório; medir llm_call_logs por resolução desde o dia 1, alertar se a média passar de R$ 0,55 e derivar conversas anômalas para fluxo determinístico ou humano.
- Ótica de corte de franquia nos planos altos (8.000 mensagens viram 500 atendimentos): concorrente pode explorar; resposta pronta com MPR, mensagens ilimitadas por atendimento, trilho de equivalência e garantia de 90 dias. O contra-ataque: o modelo antigo era insustentável para qualquer fornecedor honesto (Scale cheio custaria R$ 7.200 de LLM sobre R$ 1.497).
- Tarifa final de 01/10 sair acima da referência de R$ 0,035 (a Meta publica até 01/09): a margem ZappIQ não muda (é do cliente), mas o TCO e o discurso mudam; refazer simuladores e materiais no dia da publicação; o cenário C (R$ 0,08) já está modelado.
- Franquia esgotada com teto desligado = IA parada = churn: mitigar com alertas precoces, modo assistido elegante (Maestro + humano seguem funcionando) e upgrade em 1 clique; nunca silêncio para o cliente final.
- Bug de bilhetagem metered = susto no boleto = quebra da promessa central do modelo: sombra de 30 a 60 dias antes de cobrar, preview de fatura, dupla contagem Redis x Postgres, kill switch e reconciliação diária (malha audit_only existente vira ativo).
- Meta Business Agent melhorar rápido ou ganhar faixa gratuita para PME: defender por profundidade (CRM, agenda, campanhas, transbordo, LGPD Brasil) e pela aritmética do token; revisitar o comparativo todo mês.
- Novos termos de 23/09 (várias integrações no mesmo número, cada uma com cobrança própria) facilitam o cliente plugar um segundo fornecedor no nosso número: transformar em oportunidade de coexistência e no programa Partner; exige o item G de multi-integração no roadmap.
- Founders com franquia +30% e uso intenso: margem fina no pior caso absoluto (Growth Founders cheio fica em ~12%); cohort pequeno, monitorado org a org, e o uso real hoje é baixíssimo.
- Janela de execução curta até 01/10: o crítico de outubro é ledger + Medidor Meta + signup v4 + comunicação; a cobrança por resolução pode virar em 01/11 ou 01/12 sem risco comercial, desde que a sombra esteja medindo desde setembro. Não acoplar os dois lançamentos.
- Premissas calibradas em amostra minúscula (5,6 msgs por atendimento e 1,12 balões vêm de 1 org): recalibrar franquias, preços de excedente e cenários com os dados da sombra antes da virada; cláusula de revisão de tabela em 90 dias para contratos novos.
- Blip Go/Claro pressionando o piso de preço com distribuição de operadora (800 clientes em 10 dias): o Essencial a R$ 147 segura o flanco de entrada sem canibalizar o Lite; medir upgrade Essencial para Lite como KPI do funil.

