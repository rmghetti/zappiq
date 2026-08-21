## nome

Modelo Conta Clara: mensalidade blindada + canal Meta transparente (apelido interno: Motor e Combustível)

## tese

A partir de 01/10/2026 a Meta cobra cada mensagem de serviço. Quem promete "tudo incluso" vai quebrar a margem ou trair o preço. A ZappIQ separa de vez o que sempre foi separado na arquitetura: a mensalidade paga o motor (Iza, RAG, auto-correção auditada, CRM, Maestro, Agenda) e não muda um centavo; a tarifa Meta é o combustível, conta do canal, paga pelo cliente direto à Meta, em BRL, a preço de tabela pública, sem markup, com medidor em tempo real, projeção e teto dentro do painel (Cost Guard + Conta Clara). A franquia de mensagens de IA passa a dimensionar o custo de processamento de IA, não o canal. Resultado: margem bruta da plataforma imune à tarifa (70% ou mais no uso esperado), previsibilidade preservada por teto e transparência, e a mesma fundação (ledger de custo por integração + carteira) vira a base do programa Partner white-label em 2027.

## tabela_planos

## Grade proposta (vigência 01/09/2026 para novos contratos; base atual grandfathered)

| Item | Lite | Growth (carro-chefe) | Scale | Max (novo) | Enterprise |
|---|---|---|---|---|---|
| Preço mensal | R$ 247 | R$ 497 | R$ 1.497 | R$ 3.497 | sob consulta |
| Anual (-20%) | R$ 197,60/mês | R$ 397,60/mês | R$ 1.197,60/mês | R$ 2.797,60/mês | negociado |
| Founders (-30% vitalício) | R$ 172,90 | R$ 347,90 | R$ 1.047,90 | R$ 2.447,90 | n/a |
| Mensagens de IA/mês | 2.000 (sobe de 1.500) | 8.000 (mantém) | 25.000 (recalibrado de 80.000) | 60.000 | custom |
| Atendimentos estimados (5 respostas/conversa) | ~400 | ~1.600 | ~5.000 | ~12.000 | custom |
| Disparos/mês (software de campanha) | 200 | 5.000 | 25.000 | 60.000 | custom |
| Atendentes | 2 (sobe de 1) | 10 | 75 | ilimitado | ilimitado |
| Contatos | 1.000 | 10.000 | 200.000 | ilimitado | ilimitado |
| Números WhatsApp | 1 | 1 (+extra por add-on) | 3 | 5 | custom |
| Canais | WhatsApp + Instagram + Webchat | idem | idem | idem | idem |
| Maestro (fluxos determinísticos, sem LLM) | ilimitado | ilimitado | ilimitado | ilimitado | ilimitado |
| Conta Clara (medidor Meta em tempo real, extrato por conversa, projeção) | incluído | incluído | incluído | incluído | incluído |
| Cost Guard (teto configurável, alertas 70/90/100%, modo econômico) | incluído | incluído | incluído | incluído | incluído |
| Agenda e agendamento pela IA | não | sim | sim | sim | sim |
| API / integrações | básico | completo | completo | completo + SSO | dedicado |
| SLA | padrão | padrão | 99,9% | 99,9% + CSM | contratual |
| Trial | 14 dias sem cartão (500 msgs IA, webchat + Instagram completos; WhatsApp ativa ao conectar billing Meta) | idem | idem | demo assistida | POC |

## Excedente e pacotes (opt-in, nunca automático por padrão)

| Mecanismo | Preço | Observação |
|---|---|---|
| Pack 1.000 msgs IA | R$ 59 | one-shot, não expira no mês |
| Pack 5.000 msgs IA | R$ 249 | substitui pack antigo de R$ 99 (nunca vendido) |
| Pack 20.000 msgs IA | R$ 799 | melhor R$/msg |
| Overage automático | R$ 0,06/msg | só com auto-overage LIGADO pelo cliente + teto mensal em R$ definido por ele |
| Ao atingir 100% sem auto-overage | R$ 0 | IA pausa com aviso, humanos e Maestro determinístico seguem; cliente escolhe pack, upgrade ou espera a virada |

## Add-ons (mantidos)
Número WhatsApp extra R$ 99/mês; Mira e Zap Impulso conforme catálogo atual.

## As três linhas de rodapé obrigatórias da página de preços
1. A mensalidade cobre a plataforma completa: IA com RAG e auto-correção auditada, CRM, Agenda, Maestro, atendentes, suporte. Zero setup. Sem cobrança por conversa pela ZappIQ.
2. A tarifa da Meta (WhatsApp) é conta do canal, paga por você direto à Meta, em reais, a preço de tabela pública (hoje R$ 0,035/msg de serviço como referência), sem nenhum markup da ZappIQ. O painel mostra tudo e você define o teto.
3. Instagram Direct e Webchat não têm tarifa da Meta. Mensagens recebidas nunca pagam nada.

## unit_economics

## Premissas declaradas
- Câmbio R$ 5,40/US$ (só para custo LLM; a tarifa Meta já é publicada em BRL).
- Custo LLM por mensagem de IA (geração + RAG + auditoria seletiva, com roteamento de modelos e caching): eficiente R$ 0,025 / base R$ 0,035 / caro R$ 0,05. Dado real atual: US$ 0,0134 por chamada LLM e 1,12 balão por resposta.
- Infra alocada por org ativa (Fly, Supabase, Redis, TTS, observabilidade): Lite R$ 15 / Growth R$ 30 / Scale R$ 90 / Max R$ 200.
- Taxas de pagamento 2,6% da mensalidade.
- Utilização esperada da franquia: 35% (p50 típico de SaaS com franquia; hoje a base real usa muito menos).
- Tarifa Meta de serviço por msg ENTREGUE (conta do CLIENTE, pass-through 100%, fora do COGS ZappIQ): cenário A R$ 0,035 (referência oficial = utility BRL vigente) / B R$ 0,05 / C R$ 0,08 (estresse). Outbound de serviço ≈ msgs IA x 1,2 (1,12 balão/resposta + mensagens humanas).

## Tabela 1: margem ZappIQ por plano no uso esperado (35% da franquia, LLM base R$ 0,035)

| Plano | Receita | LLM | Infra | Taxas | COGS total | Margem R$ | Margem % |
|---|---|---|---|---|---|---|---|
| Lite | 247,00 | 24,50 (700 msgs) | 15,00 | 6,42 | 45,92 | 201,08 | 81,4% |
| Growth | 497,00 | 98,00 (2.800) | 30,00 | 12,92 | 140,92 | 356,08 | 71,6% |
| Scale | 1.497,00 | 306,25 (8.750) | 90,00 | 38,92 | 435,17 | 1.061,83 | 70,9% |
| Max | 3.497,00 | 735,00 (21.000) | 200,00 | 90,92 | 1.025,92 | 2.471,08 | 70,7% |

Blended da plataforma no uso esperado: 70,7% a 81,4% em todos os planos. Meta de 70% cumprida. Founders (30% off) no Growth: receita 347,90, margem 206,98 = 59,5% (positiva; cohort limitado e fechado).

## Tabela 2: o ponto central do modelo. A margem ZappIQ é IDÊNTICA nos 3 cenários de tarifa Meta

| Cenário de tarifa Meta | Margem ZappIQ Lite | Growth | Scale | Max | Por quê |
|---|---|---|---|---|---|
| A (R$ 0,035) | 81,4% | 71,6% | 70,9% | 70,7% | tarifa é pass-through: o cliente paga a Meta na WABA dele |
| B (R$ 0,05) | 81,4% | 71,6% | 70,9% | 70,7% | idem: zero reais da tarifa passam pelo nosso P&L |
| C (R$ 0,08) | 81,4% | 71,6% | 70,9% | 70,7% | idem: nosso risco de tarifa é comercial (conta do cliente), não de margem |

O que os cenários A/B/C mudam é a conta do CLIENTE, e o Cost Guard existe para essa conta nunca assustar:

| Plano | Uso | Outbound serviço/mês | Conta Meta A | Conta Meta B | Conta Meta C | Custo total do cliente no A (mensalidade + Meta) |
|---|---|---|---|---|---|---|
| Lite | esperado | 840 | R$ 29,40 | R$ 42,00 | R$ 67,20 | R$ 276,40 |
| Lite | franquia cheia | 2.400 | R$ 84,00 | R$ 120,00 | R$ 192,00 | R$ 331,00 |
| Growth | esperado | 3.360 | R$ 117,60 | R$ 168,00 | R$ 268,80 | R$ 614,60 |
| Growth | franquia cheia | 9.600 | R$ 336,00 | R$ 480,00 | R$ 768,00 | R$ 833,00 |
| Scale | esperado | 10.500 | R$ 367,50 | R$ 525,00 | R$ 840,00 | R$ 1.864,50 |
| Scale | franquia cheia | 30.000 | R$ 1.050,00 | R$ 1.500,00 | R$ 2.400,00 | R$ 2.547,00 |
| Max | esperado | 25.200 | R$ 882,00 | R$ 1.260,00 | R$ 2.016,00 | R$ 4.379,00 |
| Max | franquia cheia | 72.000 | R$ 2.520,00 | R$ 3.600,00 | R$ 5.760,00 | R$ 6.017,00 |

Disparos de marketing (já cobrados hoje, sem mudança em outubro): R$ 0,3217/msg na conta Meta do cliente; a Conta Clara mostra por categoria.

## Tabela 3: sensibilidade REAL da nossa margem (custo LLM), na franquia CHEIA (pior caso)

| Plano | LLM eficiente 0,025 | LLM base 0,035 | LLM caro 0,05 |
|---|---|---|---|
| Lite | 71,1% | 63,0% | 50,8% |
| Growth | 51,1% | 35,0% | 10,9% |
| Scale | 49,6% | 32,9% | 7,9% |
| Max | 48,8% | 31,6% | 5,9% |

Leitura: nenhum plano fica deficitário nem no pior caso (franquia cheia + LLM caro). Era exatamente o furo da grade antiga: o Scale de 80.000 msgs ficava negativo só de LLM (80.000 x 0,035 = R$ 2.800 > R$ 1.497), por isso a recalibração para 25.000. A defesa da margem é interna: roteamento de modelo obrigatório (custo médio <= 0,035), caching, auditoria seletiva, monitor por org via llm_call_logs (já existe) e teto duro hardCeilingBrl (já existe). Packs e overage trazem receita nova junto com o uso extra da cauda.

## Referência de competitividade por atendimento (5 respostas de IA)
- Meta Business Agent: ~112.500 tokens x US$ 2/M x 5,40 = R$ 1,08 a 1,35 por atendimento, só a IA, sem CRM, sem agenda, sem funil (e cobra até na janela de anúncio).
- ZappIQ Growth: plataforma R$ 0,31 a 0,89 por atendimento (franquia cheia a uso esperado) + tarifa Meta R$ 0,21 no cenário A = R$ 0,52 a 1,10 com a plataforma inteira incluída.

## mudancas_produto

- Ledger de custo Meta (M, pronto até 25/09): parar de descartar pricing/billable/category e conversation dos webhooks de status (campaignStatus.util.ts e whatsappService.ts hoje jogam fora); nova tabela meta_cost_events + agregados por org, conversa e categoria. É a fundação de Conta Clara, Cost Guard e do futuro rebilling.
- Painel Conta Clara (M, beta em 15/09): consumo Meta em tempo real, extrato por categoria e por conversa, projeção de fatura (run-rate), custo por atendimento, comparativo com o mês anterior.
- Cost Guard enforcement (M, ativo em 01/10): teto em R$ configurável por org com ações graduais: 70% alerta, 90% modo econômico (resposta condensada em 1 balão, suspende follow-ups proativos, pausa disparos), 100% pausa disparos e, só se o cliente escolher, pausa respostas não urgentes. Reaproveita ~70% pronto: hardCeilingBrl, alertas multi-canal e admin quota-watch já existem em audit_only.
- Onboarding de billing Meta (P/M, no ar em 15/09): passo guiado 'Ative sua conta Meta' no ConectarCanais: anexar forma de pagamento na WABA, escolher BRL (fatura Facebook Brasil), definir teto; verificação via API do estado do billing + banner 'a partir de 01/10 a Meta não entrega mensagem paga sem billing ativo'.
- Embedded Signup v4 (P código + config no painel Meta, até 30/09 com folga para o corte de 15/10): trocar extras/config_id em ConectarCanais.tsx:394-397 e validar Advanced Access.
- Metering do canal web (P): conversas de webchat hoje não persistem mensagens; passar a contar na franquia de msgs de IA (a cota agora limita custo de LLM, e webchat consome LLM igual). Único cliente pagante atual usa web: comunicar com grandfathering.
- Enforcement de cotas sai de audit_only (P/M, 01/10): QUOTA_OVERAGE_MODE=enforce com UX de escolha (pack, upgrade, auto-overage opt-in com teto); reprecificar meter Stripe de R$ 0,03 para R$ 0,06 e packs novos (1k/5k/20k = 59/249/799); ligar enforceLimit nos broadcasts (hoje sem nenhum caller).
- SLO de eficiência de tarifa (P): travar 1 balão por resposta como métrica pública (hoje 1,12), botões/listas para reduzir turnos, priorização de janela CTWA 72h grátis; KPI mensagens-por-resolução no dash (agregação sobre TenantUsageMonthly, já existe a matéria-prima).
- Simulador de outubro (P, no ar até 05/09): pré-venda e in-app: 'sua conta Meta em outubro será ~R$ X pelo seu histórico', atualizado com a tabela oficial que a Meta publica até 01/09.
- Monitor de saúde de WABA e billing (P/M): cron multi-org com quality_rating (check já pronto em channelCredentialCheck.ts) + estado do billing + alertas; depois assinar webhooks account_update/phone_number_quality_update.
- Identidade BSUID (M, Q4): phone nullable + coluna bsuid única por org + roteador de identidade no webhook (padrão 'ig:<igsid>' já provou o caminho); 37 arquivos tocam phone.
- Fundação multi-integração e rebilling white-label (G, 4 a 8 semanas, Q1 2027): modelo Channel/Integration (hoje 1 número por org via campo @unique), roteamento de webhook por integração, carteira pré-paga (Pix/cartão) com repasse a custo + taxa de gestão declarada de 10%, e markup configurável por parceiro. Depende dos termos de 23/09 (Messaging Account por app) ou de virar Solution Partner; decidir em novembro.
- Higiene de dados comerciais (P): remover enum BUSINESS e seeds com preços antigos (R$ 197/997/1.997) que geram o MRR fantasma antes de qualquer material externo usar receita do banco.

## migracao_base

A base real torna a virada quase indolor: 1 cliente pagante (Growth anual, canal web, zero mensagens de WhatsApp), a org institucional da Iza e 11 seeds. É a última janela para trocar o motor sem avião cheio.

Princípio inegociável: ninguém da base perde nada. Preço nominal congelado, franquia contratada garantida (quem tem 8.000/80.000 mantém 8.000/80.000), zero setup segue, e a tarifa Meta nunca esteve dentro da mensalidade (a WABA e o billing sempre foram do cliente); o que muda é que agora ela fica visível, medida e com teto.

Cohort Founders (30% vitalício): o desconto incide sobre a mensalidade da plataforma e fica intocado para sempre, inclusive em upgrades de plano e na grade nova. Founders ganham ainda: (1) franquia antiga grandfathered com direito de migrar para a grade nova quando quiserem e voltar atrás em até 90 dias; (2) Conta Clara e Cost Guard inclusos sem custo; (3) Pacote Outubro: sessão 1:1 de otimização de tarifa (CTWA 72h, 1 balão, botões, modo econômico) + relatório mensal de economia nos 3 primeiros meses. Custo marginal ~zero, valor percebido alto, promessa honrada em público.

Calendário:
- 20/08 a 31/08: ledger de custo Meta no ar capturando pricing (mesmo antes da cobrança); e-mail 1 à base: "o que muda na Meta em outubro (e o que não muda na ZappIQ)"; simulador aberto no site.
- 01/09 a 14/09 (Meta publica a tabela oficial até 01/09): simulador atualizado com a tarifa real; Conta Clara em beta no dash; e-mail 2 individual com a projeção de conta Meta de cada cliente pelo histórico; grade nova entra no site SÓ para novos contratos.
- 15/09 a 30/09: checklist de billing Meta obrigatório (banner + verificação via API de forma de pagamento e BRL na WABA); webinar "Outubro sem susto"; Embedded Signup v4 publicado.
- 01/10: chave virada; Cost Guard ativo com tetos default sugeridos (Lite R$ 50, Growth R$ 150, Scale R$ 500, ajustáveis); relatório semanal de consumo nas 4 primeiras semanas para toda a base.
- 15/10+: retrospectiva pública (post) com dados agregados de economia; varredura de reação dos concorrentes.

Contratos: aditivo simples de transparência (não de preço): explicita que a tarifa Meta é do cliente junto à Meta, que a ZappIQ não aplica markup e que o cliente controla o teto. Sem reassinatura forçada; aceite eletrônico no dash.

## narrativa_vendas

Mote central: "Em outubro a Meta muda o preço DELA. A ZappIQ não muda o SEU." Complemento: "Plataforma por mensalidade fixa. Canal a preço de tabela Meta, em reais, sem markup, com medidor e teto. Como conta de luz: você vê cada centavo e decide o limite." A bandeira antiga "mensalidade fixa sem cobrança por conversa" evolui para "a ZappIQ não cobra por conversa. E ninguém deveria lucrar em cima da tarifa da Meta: nem nós."

Contra Blip Go/Claro (R$ 179,90 a 399,90 na fatura da Claro): é o plano de celular do atendimento: 50 a 300 disparos, IA rasa, CRM Light, sem integrações profundas; acabou o pacotinho, acabou o mês, e a tarifa Meta vem embutida onde você não vê. ZappIQ Lite por R$ 247: IA de verdade com RAG da SUA base e auto-correção auditada, CRM completo, agenda, 2.000 respostas de IA (~400 atendimentos), Instagram e webchat juntos, e o canal a custo Meta na sua conta, auditável linha a linha. LGPD com dados no Brasil. Frase de combate: "o plano da operadora cabe na fatura; a sua operação não cabe em 50 disparos".

Contra Zenvia (R$ 600 a 3.900 + setup desde R$ 649 + pacotes de canal de R$ 100 a 2.000): três cobranças opacas empilhadas. ZappIQ: zero setup, uma mensalidade, canal sem markup com extrato aberto no painel. A Zenvia orienta o cliente a "economizar mensagens"; a ZappIQ entrega a economia como produto (modo 1 balão, CTWA 72h, relatório mensal de economia).

Contra GPT Maker e Zaia (créditos): crédito é ficha de fliperama: resposta com modelo bom queima 5 a 10 fichas e ninguém sabe converter crédito em atendimento. Na ZappIQ 1 resposta = 1 mensagem de IA, sempre, em qualquer modelo. E o excedente nunca cobra sozinho: no limite, você escolhe (pack, upgrade ou pausa), teto é padrão, susto é impossível.

Contra o Meta Business Agent: o "grátis" acabou em agosto: US$ 2 por milhão de tokens dá R$ 0,22 a 0,27 POR RESPOSTA, cobrado até dentro da janela de anúncio, em dólar com câmbio do dia, exigindo linha de crédito na Meta do mesmo jeito. E é só um respondedor: sem CRM, sem funil, sem agenda, sem transbordo para humano de verdade, sem auditoria do que a IA prometeu, dados fora do Brasil. A isenção de tarifa de serviço do MBA não fecha conta: a tarifa é R$ 0,035; o token do MBA custa 6 a 7 vezes isso por resposta. Conta aberta por atendimento de 5 respostas: MBA R$ 1,08 a 1,35 só de IA; ZappIQ Growth R$ 0,52 a 1,10 com a plataforma inteira, que qualifica, agenda, registra e vende. Frase de combate: "a IA da Meta responde; a Iza atende, agenda e vende, por menos".

Provas que sustentam a narrativa (anti-blá-blá-blá): medidor público na Conta Clara, extrato por conversa, tarifa Meta linkada à tabela oficial, garantia de teto por escrito ("defina R$ X; nós seguramos"), relatório mensal "quanto você economizou de tarifa". Timing: publicar tudo na semana de 01/09, quando a Meta solta a tabela oficial e os concorrentes ainda estarão calados (até 20/08 nenhum dos 11 players anunciou posição). Ser o primeiro a explicar a mudança em português simples vale mídia espontânea e define o enquadramento: transparência versus pacote opaco.

## riscos

- Tarifa final de outubro ainda não publicada (coluna Service sai até 01/09): pode vir acima da referência de R$ 0,035. Mitigação: simulador com cenários até R$ 0,08, nenhum número externo antes da tabela oficial, margem ZappIQ estruturalmente imune (pass-through).
- Fricção de billing na Meta trava ativação de PME (cadastrar cartão na Central de Cobrança, formas de pagamento aceitas no Brasil ainda não verificadas): mitigação com onboarding guiado e verificado via API, trial pleno em webchat + Instagram, FEP 72h via CTWA, e carteira gerida pela ZappIQ como Fase 2 (2027) para quem não quiser lidar com a Meta.
- A Meta subsidia o concorrente dela: MBA isento da tarifa de serviço e distribuído nativamente; pode baixar o preço por token ou recriar faixa grátis para PME. Mitigação: vender resultado (CRM, agenda, auditoria, humano no loop), custo por atendimento hoje menor que o MBA, multicanal e LGPD Brasil.
- Margem sensível ao custo de LLM, não à Meta: franquia cheia com LLM caro derruba Growth/Scale para um dígito. Mitigação: roteamento de modelo e caching obrigatórios (custo médio <= R$ 0,035/msg), monitor por org via llm_call_logs, teto interno hardCeilingBrl, repactuação de agente outlier.
- Recalibração do Scale (80.000 para 25.000 msgs) pode ser explorada por concorrente como 'redução disfarçada'. Mitigação: grandfathering total e público da base, vitrine em atendimentos (~5.000), comparação honesta com créditos dos rivais (25.000 respostas reais > 30.000 créditos que rendem 3.000 a 6.000 respostas).
- Nova estrutura de conta (termos 23/09, migração automática, WAAC + Messaging Account) pode quebrar webhooks, signup ou billing no meio do trimestre; janela '23/09 a 15/10' dos e-mails não consta nas docs públicas. Mitigação: Embedded v4 cedo, monitor de saúde de WABA, leitura dos termos completos logado, plano de contingência de envio.
- Risco de percepção: cliente confundir a fatura da Meta com cobrança da ZappIQ e sentir quebra da promessa de mensalidade fixa. Mitigação: a fatura é da Facebook Brasil (não nossa), copy 'conta de luz', simulador antes da cobrança, teto default ligado desde o dia 1, relatório semanal no primeiro mês.
- Enforcement de cotas mal calibrado pode pausar a IA de cliente legítimo e gerar churn justamente na virada. Mitigação: default nunca bloqueia atendimento sem escolha explícita do cliente, grace de 60 dias para orgs novas (já existe), auto-overage sempre opt-in com teto.
- Programa Partner/white-label depende de detalhe não confirmado: quem anexa pagamento na Messaging Account do app na nova estrutura (rebilling sem virar Solution Partner). Mitigação: decisão formal em novembro após ler os termos; alternativa Solution Partner com linha de crédito já mapeada; nada do modelo 2026 depende disso.
- Dependência cambial e de reprecificação recorrente da Meta (tarifa em USD como referência, MBA convertido por câmbio diário): mitigação estrutural: nunca mais prometer preço que embuta custo Meta; contratos e copy tratam o canal como pass-through permanente.

