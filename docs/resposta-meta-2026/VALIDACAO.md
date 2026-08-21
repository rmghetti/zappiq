# Log de validação do Plano de Resposta à Meta (loop de 4 sessões)

Este arquivo é o estado durável do loop de validação. Cada sessão lê o plano
(`PLANO-RESPOSTA-META.md` nesta pasta), executa a sua pauta com agentes
especialistas, registra achados aqui e ajusta o plano quando o achado exigir.
Regras: português do Brasil, sem travessão, achado sempre com evidência
(arquivo:linha, URL com data, ou conta aberta). Nada de "validado" sem prova.

## Pauta das sessões

### Sessão 1: Economia (status: CONCLUÍDA em 20/08, aprovada com condições; correções aplicadas ao plano)
Stress test do modelo recomendado com os dados reais da base e cenários de
tarifa (piso, médio, teto). Margem por plano e por cliente real, elasticidade
de preço na PME, impacto no cohort Founders (desconto vitalício), ponto de
equilíbrio do add-on de consumo, LTV/CAC do novo funil.
Agentes: modelador financeiro SaaS, auditor de premissas, advogado do diabo
econômico.
Critério de aprovação: margem bruta da plataforma >= 70% nos 3 cenários, sem
subsídio escondido de tarifa Meta.

### Sessão 2: Técnica (status: CONCLUÍDA em 20/08; aprovada com 3 cortes; correções aplicadas)

#### S2 · CONSOLIDAÇÃO
Critério ("o escopo de 01/10 cabe com 1 semana de folga, sem quebrar tenant nem cohort"): **APROVADO COM 3 CORTES**, os dois que o plano já autorizava (simulador adia; Conta Clara GA vira beta estendida) mais um novo (SAI o pareamento multi-tenant no número global; demo dia-0 = webchat/playground + Iza institucional). Núcleo em ~28 a 32 dias-pessoa contra ~29 úteis, altamente paralelizável, tudo ADITIVO (kind novo de contador, tabelas novas, audit_only intacto). Sequência de 17 PRs com marcos definida (parecer completo do arquiteto em tasks/a2d54c68f769aea09.output). Condições: migração aditiva única na semana 1; signup v4 ANTECIPADO para 08 a 12/09 (dependência externa do painel Meta); corrigir o enum de plano ANTES da grade nova.

#### S2 · Agente Meta Cloud API (concluído 20/08)
- CORREÇÃO DE FATO: o embedded signup está na **v2** (sessionInfoVersion é versão do payload, não do fluxo; v3 usaria version:'v3'). Corte duro 15/10. Migração v4 = nova config de FB Login for Business + troca de config_id + extras {setup:{}} + tratar FINISH_ONLY_WABA/CANCEL; esforço P; sem downtime. APLICADO ao plano.
- REQUALIFICAÇÃO: doc oficial do Embedded Signup confirma que cliente de Tech Provider "must attach a payment method to their WABA before they can begin messaging" JÁ HOJE; falha = erro 131042. Billing readiness é pré-requisito de go-live, não precaução de outubro. APLICADO.
- AVISO CRÍTICO do guia do cliente: país e moeda TRAVAM no primeiro cartão salvo (escolher Brasil+BRL antes); Currency Migration API (3 chamadas, token da org serve) CLONA a WABA e muda o whatsappBusinessAccountId salvo.
- LEDGER: campos confirmados nos statuses (pricing.billable, pricing_model "PMP", category, e o campo TYPE: regular | free_customer_service | free_entry_point); gravar no evento delivered com dedup por wamid; teste de aceitação natural na virada: serviço muda de free_customer_service para regular. Existe API oficial de conferência legível com o token da org: GET /WABA_ID?fields=pricing_analytics (COST/VOLUME por categoria/tipo/tier/dia).
- Demo dia-0: test number oficial limita a 5 destinatários (não escala); número global viável só como demo institucional da Iza.
- Nomenclaturas corrigidas: webhook de troca de identidade é user_id_update; teste de BSUID é pelo simulador de payloads do App Dashboard (não existe "Dummy API"); envio para BSUID usa campo recipient no lugar de to.
- Nova estrutura de conta: nada obrigatório na Fase 1; paid_messaging_account_id não existe no repo (item 31/12 atendido por vacuidade); multi-integração (Channel com waacId/messagingAccountId) na Fase 2 = Q1 2027, e vira argumento de aquisição (testar a ZappIQ no número que já usa com outro provedor).
- Maior risco externo: tabela final só em 01/09 (comprime simulador/e-mails/tetos) + comportamento exato de WABA sem billing em 01/10 não publicado.

#### S2 · Agente arquiteto backend (concluído 20/08)
- Achados que MUDAM o plano: roteamento de modelo por tier JÁ EXISTE E ESTÁ VIVO (TIER_PRIMARY_PROVIDER: STARTER/GROWTH -> gemini-flash, SCALE+ -> sonnet; escalada por intent; o que falta é prompt caching + benchmark + teto de verificação); pipeline principal já é 1 balão por turno (o risco de multi-balão é o MAESTRO: send_text consecutivos; consolidar em executeFlowEffects); a reabertura de conversa já cria conversa nova após CLOSED (a unidade "atendimento por 72h" nasce quase de graça: falta só o job de expiração + closeReason); persistência do webchat é cirúrgica (ensureWebChatLead já upserta Contact/Conversation e o handler descarta o retorno; gravar Message in/out é 1 a 2 dias); trial por ativação é barato (mover trialStartedAt do onboarding para o 1º inbound; lifecycle NOVO já dá acesso sem paywall).
- BLOQUEADOR NOVO: enum Prisma PlanType = STARTER/GROWTH/SCALE/BUSINESS/ENTERPRISE, NÃO contém IZA_LITE (vários fallbacks || 'IZA_LITE' no código); qualquer plano novo (Essencial) exige migrar o enum ou plan vira String validada. Entra na higiene ANTES da grade.
- AJUSTES DE PROMESSA: o check de saúde da WABA NÃO detecta falta de billing (Graph não expõe billing do cliente ao Tech Provider; bloqueio só aparece ao tentar entregar): billing readiness é campanha + passo de onboarding, nunca detecção automática. Crédito CAC não pode pagar a fatura Meta do cliente (faturada direto pela Meta): vira desconto equivalente na MENSALIDADE ZappIQ via cupom ("descontamos até R$ 50 da sua mensalidade, o equivalente à sua primeira fatura Meta").
- Desenhos aprovados: ledger em tabela nova meta_billing_events (nunca colunas em Message; idempotência por wamid; rawPricing Json; preço via metaRateCard.ts versionado no shared); Cost Guard sobre a fila cron única com metaCostCapBrl derivado + soft-stop + carência 48h + modo pico + hard-stop opt-in via flag Redis no passo 5.5; Modo Econômico com 5 alavancas existentes (tier STARTER, maxTokens 512, skipClassify, RAG top-k 3, escalada preservada só para request_human; NUNCA silêncio); hard cap 2x como exceção explícita gateada por org (nunca flip global do audit_only); CAPTCHA v1 = honeypot + rate limit (Turnstile depois).
- Operacional: working tree da main tem edições não commitadas de OUTRA sessão (webChatWidget.ts, conversations/page.tsx): trabalhar em worktree e coordenar. Feriado 07/09 conta na janela.

#### S2 · Agente Stripe/billing (concluído 20/08)
Veredito: o INDISPENSÁVEL cabe até 01/10 com folga curta (catálogo v5 + mapas + planConfig v5 por entitlementVersion + trial por ativação + Founders via cupom + tabela de aceite + neutralizar código do meter); packs, flip de enforcement e garantia ficam para 01/11 a 01/12 como o plano já previa; atraso no metering sombra empurra o enforcement, não a grade. Decisões de desenho (recomendação única por tópico):
- Prices v5 NOVOS sob os MESMOS Products (lookup_key zappiq_v5_*; Product novo só para o Essencial). Motivo estrutural: o cupom Founders forever é escopado por Product; trocar de Product ou recriar assinatura DESTRÓI o desconto vitalício. Entitlement resolvido por priceId (resolvePlanFromPriceId ganha mapa v5 + LEGACY_V4_PRICE_MAP no padrão do V32 já existente em billing.ts:51-60); metadata pricing_version com backfill nas subs antigas.
- getEffectivePlan hoje lê só o enum org.plan: régua v4 e v5 seriam indistinguíveis (nominais iguais). Passar a resolver por (plan, entitlementVersion). Upgrade de org grandfathered = evento de migração com aceite prévio (senão o /change migra régua silenciosamente com always_invoice).
- Trial por ATIVAÇÃO: gerenciado pela aplicação (mover a escrita de trialStartedAt de onboarding.ts:118-131 para o 1º inbound real de WhatsApp; ativação forçada em D+30; ressuscitar assertTrialCostCap como cadeado pré-ativação). Subscription criada SÓ na conversão.
- Packs: clonar o fluxo provado do Mira (mode payment + crédito idempotente no webhook + ledger mensal com packPurchases[]); máximo 2/mês é gate da aplicação em 2 pontos (session + recheck no webhook; se a 3ª escapar, credita e alerta para estorno manual, nunca cobra sem entregar). NÃO usar settings.addons (deduplica por key).
- Grandfathering: congelamento natural do Stripe + P90+20% arredondado para degrau padrão (NUNCA price por cliente); virada só na renovação; quando o nominal não muda, é flip de entitlement + aceite, sem Schedule.
- Meter R$ 0,03: aposentadoria segura na ordem (1) confirmar zero subs com o price, (2) NEUTRALIZAR O CÓDIGO ANTES (branch de autoOverage e hardCeilingBrl são precificados pelo hardcode 0,03: virariam aritmética mentirosa), (3) arquivar price, (4) desativar meter, (5) deprecar no catálogo.
- Aditivo: tabela append-only OrgAgreementAcceptance (docVersion + docHash sha256 + ip/userAgent), padrão CampaignConsent; aceite é pré-condição do Schedule de migração e rechecado no webhook; NUNCA condiciona a cobrança, só a troca de régua.
- Garantia 1º mês: Customer Balance credit (createBalanceTransaction), capada em min(delta, teto Cost Guard, teto do programa), 1 por org, kill-switch agregado; SÓ MENSAL (anual pré-pago não tem fatura seguinte); dependência dura do ledger de custo Meta.
- Furos colaterais achados: webhook Stripe NÃO trata charge.refunded/dispute (pack estornado manteria crédito); checkout é SÓ CARTÃO hoje (billing.ts:175), a premissa de 3% de taxas exige Pix/boleto ou a margem perde ~1,3 p.p.; org past_due não pode comprar pack (precedente Mira).
- 5 riscos em ordem: régua dupla sem discriminador; flip de enforcement com semântica velha (reescrever ANTES); unidade atendimento sem medição (caminho crítico real, depende da persistência do webchat); garantia como passivo aberto; pagante único + cupom forever (100% da receita real).
Parecer completo: tasks/a2ca6dcfd345189f2.output (sessão desta conversa).
Cada mudança de produto do modelo contra o repositório real (~/dev/zappiq):
metering e enforcement, Cost Guard, billing engine (Stripe metered ou wallet),
desacoplamento BSUID, embedded signup v4, monitor de saúde de WABA, campanha
de billing readiness, rebilling multi-integração. Escopo mínimo executável até
01/10 com plano de PRs sequenciado.
Agentes: arquiteto backend, especialista Stripe/billing, especialista Meta
Cloud API.
Critério de aprovação: escopo de 01/10 cabe em engenharia com margem de
segurança de 1 semana, sem quebrar tenant nem cohort atual.

### Sessão 3: Mercado e comunicação (status: CONCLUÍDA em 20/08; aprovada com 3 ressalvas, todas aplicadas)

#### S3 · CONSOLIDAÇÃO
Critério ("cada objeção letal tem resposta com número; comunicado em voz humana; sem promessa que case não comprove"): **APROVADO COM 3 RESSALVAS APLICADAS**: (1) bandeira corrigida para "mensalidade fixa por atendimento" (a versão "clientes atendidos" contradizia a unidade renomeada pela S1 e induzia erro de 4x no cliente recorrente: o distribuidor de 300 clientes semanais precisa de ~1.290 atendimentos, não 300); (2) teto default rederivado para cobrir disparos + fluxos (senão clínica e distribuidora estouravam no 1º mês; o default do Essencial nem batia com a própria fórmula); (3) promessas proibidas no pitch: grupos de WhatsApp, integração nativa e-commerce, "mais barato que o MBA" abaixo do Growth. Vereditos por persona: clínica compra Lite; e-commerce compra Growth (ancorar no GPT Maker Professional R$ 397); distribuidora compra Growth só com indicação + demo + fluxo desenhado na frente (e NÃO vender se os pedidos vivem em grupo). Gatilhos de churn do mês 1 com antídoto: débito FACEBK/META não reconhecido (e-mail de projeção antes do débito + aviso no onboarding) e atendimento dobrado por fair use sem legenda (extrato marca "conversa longa: contou 2" na linha). D8 antecipada (análise do modo fatura única pós-23/09).

#### S3 · Comprador cético (concluído 20/08)
3 personas com conta realista, 15 objeções com a fala real + resposta que fecha + resposta que perde a venda; salvas as regras no battle-card. Achados estruturais aplicados ao plano (bandeira, tetos, rito do cartão, kit do contador como canal de indicação).

#### S3 · Copy chief (concluído 20/08)
5 peças prontas em voz humana salvas em comunicacao/kit-outubro-sem-susto-v1.md: e-mail 1 à base, carta aos Founders ("Seus 30% continuam vitalícios. Palavra."), hero da página em 2 versões, FAQ de 6 perguntas, script de 30s do vendedor. Acompanha lista de 14 CLAIMS que só vão ao ar com decisões aprovadas (D1/D2/D5/D9) e marcos confirmados (ledger, Conta Clara, trial por ativação, tabela de 01/09). Nenhuma peça usa travessão nem clichê de IA; números com lastro no plano.

#### S3 · Red team comercial (concluído 20/08)
Battle-cards dos 5 confrontos salvos em comunicacao/battle-cards-v1.md (ataque real + contra + avaliação honesta). Rechecagem de mercado 14 a 20/08: NADA novo (nenhum dos 9 monitorados reposicionou; janela de enquadramento aberta até 01/09). Defesas fracas de verdade: (1) fricção do cartão na Meta contra a fatura única do Blip Go/Claro: conserto = concierge de 15 min + crédito R$ 50 + ANTECIPAR a análise da D8 (modo fatura única opcional) de novembro para logo após os termos de 23/09; (2) porte/prova social contra Zenvia/RD: conserto = cláusula "Garantia de Reversibilidade" + 3 cases Founders com número até dezembro + POC guiada. Regras de campo: nunca "mais barato que o MBA" abaixo do Growth; QR do GPT Maker vira pergunta, nunca acusação; com a Umbler não alegar fricção igual; teto sempre nomeado "Cost Guard: o teto que protege o seu bolso, não o nosso".
Narrativa contra Blip Go/Claro, Zenvia, Meta Business Agent; objeções de 3
personas de dono de PME; releitura dos comunicados à base (voz humana);
rechecagem de movimentos de concorrentes desde a pesquisa inicial; página de
preços nova em rascunho.
Agentes: comprador cético, red team comercial, copy chief.
Critério de aprovação: cada objeção letal tem resposta com número; comunicado
da base aprovado no padrão voz-humana; sem promessa que case não comprove.

### Sessão 4: Red team final e consolidação (status: CONCLUÍDA em 20/08; v1.1 publicada; LOOP ENCERRADO)

#### S4 · CONSOLIDAÇÃO FINAL
Critério ("plano final sem contradição interna, com riscos mapeados e gatilhos de contingência definidos"): **APROVADO**. O verificador achou 30 inconsistências (8 bloqueadoras, 18 ajustes, 4 cosméticas), todas corrigidas na v1.1: sumário executivo reescrito (bandeira, unidade, fair use, gate e margens atualizados), grade 7.3 consertada (Growth mantém 2º número, Scale até 15), signup v4 unificado em 08 a 12/09 como stop-the-line, gate fantasma de R$ 0,15 eliminado da seção 12, simulador resolvido pela via da S4 (calculadora estática em 01/09; simulador vivo vira feature da Conta Clara), faturas do cliente recalculadas com 5,4, D2/D3/D4/D10 reescritas (kill-switch do Essencial dentro da D3), Partner sem markup sobre tarifa, e-mails rotulados como simulação, datas unificadas (enforcement 01/11, virada 01/12). Adendo S4 adicionado ao plano com veredito, motor de demanda, checagens humanas, orçamento de capacidade e o checkpoint fechado de 01/09 (17 itens + 5 gatilhos).

#### DECISÃO DO FUNDADOR (20/08, via chat): D9 ELIMINADA
O pacote Founders saiu do projeto por inteiro (sem régua estendida, sem 1:1, sem relatório, sem carta). Aplicado em: plano (D9, seções 7.3, 7.4, 9, Adendos S1/S3), kit (Peça 2 removida, claims 11/12), battle-cards (cases de clientes). A base migra pelas regras padrão; descontos já concedidos em contrato seguem o contrato (auditoria no Stripe segue no checkpoint como item neutro). Efeito colateral positivo: sai a linha mais frágil da conta de margem (break-even LLM R$ 0,32).

#### VEREDITO FINAL DO LOOP
As 4 sessões rodaram em 20/08 com 13 agentes especialistas. S1 Economia: aprovada com condições (margem invariante à tarifa Meta confirmada aritmeticamente; gate de LLM reformulado). S2 Técnica: aprovada com 3 cortes (16 PRs de núcleo cabem até 01/10). S3 Mercado: aprovada com 3 ressalvas aplicadas (bandeira, tetos, rito do cartão). S4: GO COM CONDIÇÕES, nota 8,5/10. O plano v1.1 está pronto para a sessão de decisão do fundador (D1 a D13, exceto D9 já decidida). Próximo marco externo: tabela oficial da Meta até 01/09 (checkpoint completo no Adendo S4).

#### S4 · Red team estratégico final (concluído 20/08): NOTA 8,5/10, GO COM CONDIÇÕES nos 4 blocos
- (a) Modelo Conta Clara: GO se o gate D4 rodar ANTES da grade com página no-go pronta e diagramada até 15/09, e com o kill-switch do Essencial ESCRITO dentro da D3 (limiar objetivo: Essencial > 40% das novas assinaturas em 60 dias com downgrade líquido do Lite > 10% dispara franquia 100 + sai da vitrine; contas existentes intocadas).
- (b) Engenharia: GO se os 2 marcos de dados forem provados (migração aditiva até 31/08, ledger 05/09, webchat antes de 08/09) e signup v4 tratado como stop-the-line (12/09 sem v4 funcional = congelar o resto). Travar 16 vs 17 PRs na v1.1.
- (c) Comunicação: GO com trava de claims auditada em 01/09 e um conserto final na bandeira ("mensagens à vontade" é desmentida pelo fair use que conta o 2º atendimento: o fair use aparece na primeira dobra, nunca em asterisco). Comunicado público NUNCA antes do contato pessoal com o pagante único.
- (d) Governança/P0: GO; P0.1 e P0.2 em 48h com prova ponta a ponta; validar por query a inferência "pagante = CMJ" ANTES do contato; D11 timeboxed até 29/08; chave de 11/07 sem confirmação = rotacionar.
- TENSÕES RESOLVIDAS (recomendação única cada): T1 Essencial listado COM kill-switch pré-autorizado; T2 dividir o simulador em dois (calculadora ESTÁTICA de marketing sai em 01/09 com 1-2 dias de esforço; o simulador vivo ligado ao ledger vira feature da Conta Clara beta; o corte da S2 vale só para o segundo); T3 acoplar motor de demanda com dono e número (5 demos concierge/semana no webchat dia-0 a partir de 08/09, kit do contador como canal primário com meta de 20 contadores até 15/10, case CMJ com número até 15/10; dogfooding do Radar transferido por escrito para pós-01/10).
- O RISCO QUE NINGUÉM VIU: (i) o benchmark do gate não tem matéria-prima (362 mensagens na história; corpus será sintético gerado pela mesma família de modelo que o responde: risco de benchmark autocomplacente). Antídoto: corpus híbrido (transcripts reais CMJ + Iza institucional + históricos importados + casos adversariais), gate declarado PROVISÓRIO até 30 dias de sombra real, circuit breaker valendo desde o dia 1 independente do resultado; (ii) validação monocultura (mesmo modelo, zero humano externo): 3 checagens humanas antes de 01/09: o contador (D11 + kit), 1 cliente Founders lendo o e-mail 1, e um advogado com OAB no aditivo, na garantia e na bandeira; (iii) capacidade de UMA pessoa: orçamento por escrito (>= 60% ZappIQ até 01/10, congelar lançamentos das outras frentes em setembro, modo degradado pré-definido = núcleo nunca-cortável); (iv) funil vazio com tudo pronto: o motor de demanda da T3 entra no calendário com revisão semanal do número; (v) Meta antecipar o D-day de fato (termos 23/09 + billing já obrigatório hoje): campanha de billing readiness concluída até 19/09, não 01/10; (vi) fadiga de decisão: UMA sessão de 90 min, folha de 1 página por decisão, aprovar em bloco (precedente da casa), D1/D2/D5/D9 irreversíveis após 01/09.
- CHECKPOINT DE 01/09: checklist fechado de 17 itens + 5 gatilhos objetivos de replanejamento (registrados no plano v1.1).
Cenários adversos (Meta muda regra de novo, adoção acelerada de username,
guerra de preço do Blip Go, atraso de engenharia), teste de consistência de
todo o documento, veredito final GO/ajustar, atualização do plano e resumo
executivo final para o fundador.
Agentes: red team estratégico, verificador de consistência, sintetizador.
Critério de aprovação: plano final sem contradição interna, com riscos
mapeados e gatilhos de contingência definidos.

## Achados por sessão

### S1 · Agente 1: auditor de premissas (concluído 20/08)

Veredito: fiel às fontes na tese central (Tech Provider, COGS Meta zero, risco = LLM; fatos Meta, concorrência e código citados com precisão, confirmados por spot-check no repo). NÃO consistente na grade comercial. Aprovável após corrigir 1 a 3 (bloqueadores de comunicação externa) e ajustar 4 a 7 antes do kit de 01/09; 8 a 10 são refinamento.

1. [AJUSTAR] Grade nova muda 6 cotas sem declarar (planConfig.ts vs seção 7.3): Lite disparos 200 vira 500; Scale disparos 60.000 vira 30.000; Lite atendentes 1 vira 2; Scale atendentes 75 vira 50; Scale números 15 vira 2; Growth perde o 2º número que o próprio plano diz que ele vende; trial Growth divergente. Correção: changelog "grade atual vs nova" com cada mudança declarada como decisão.
2. [AJUSTAR] Conversão de unidade encolhe franquia na média real (5,4 balões/conversa): Lite +8%, Growth -32,5% (5.400 msgs equiv. vs 8.000), Scale -76% (18.900 vs 80.000). Cliente que usa 8.000 msgs precisa de ~1.481 conversas, não cabe em 1.000. Correção: mostrar a conta na seção 9, declarar P90+20% medido em CONVERSAS na sombra, assumir por escrito o corte deliberado de shelf-ware.
3. [SEM LASTRO] "WABA sem método de pagamento para de entregar serviço em 01/10" é inferência (fonte só confirma bloqueio de entrega por falta de pagamento para o MBA). Correção: marcar como inferência provável a confirmar no Billing Hub; anexar o e-mail de 22/07 do caso CMJ.
4. [AJUSTAR] "Ninguém se posicionou até 20/08" contradiz o anexo 2: Zavu/Chat2Desk/EvoTalks já ocuparam a bandeira zero markup. Reformular: nenhum dos 11 GRANDES reposicionou preço.
5. [AJUSTAR] Essencial R$ 147 comparado só com Blip Go/Claro (R$ 179,90); omite Blip Go direto R$ 0 a 99-349 e o Business AI grátis. Argumento correto é TCO/capacidade, não preço.
6. [AJUSTAR] "Ledger até 05/09 + backfill": backfill de custo é inviável (webhooks passados não se re-entregam; serviço nem é cobrado antes de 01/10). Trocar por captura prospectiva + projeção por contagem × tarifa de referência.
7. [AJUSTAR] Gate D4 não é mensurável com o volume atual (1 org ativa; webchat não persiste mensagens e a franquia nova conta webchat). Correção: gate por benchmark sintético + llm_call_logs da org institucional; adicionar persistência de conversas web ao pacote 8.1 como pré-requisito da unidade.
8. [CONFIRMA] "Propaganda enganosa" tem fundamento (CDC art. 37 §3º, omissão de dado essencial; art. 31); enquadrar como enganosidade por omissão, sanável com a bandeira nova.
9. [AJUSTAR] Founders: 30% sobre tabela nova honra o nominal e dilui o real (franquia equivalente menor); declarar migração pós-30/06/2027 pelo MAIOR entre régua nova e P90+20% em caráter vitalício; definir o caminho de quem NÃO aceita o aditivo (fica na régua antiga até a renovação).
10. [AJUSTAR] Ruído numérico: fixar 5,4 msgs/conversa (não 5,5/5,6); rótulo de cenário errado no anexo 7 (R$ 35 é cenário A); critério "margem >= 70%" vale no uso típico (cheia dá 67-69% em Scale/Growth); taxa de 3% do Founders calculada sobre preço cheio; teto default do Essencial ausente; "pós-CADE" é inferência não sinalizada; v3 do signup é "até outubro" sem dia (não 15/10); unificar 01/11 vs 01/12 (D6); "3 mudanças em 24 meses" é contagem própria.

### S1 · Agente 2: modelador financeiro SaaS (concluído 20/08)

Veredito do critério: PASSA CONDICIONALMENTE ao gate D4. Invariância aos 3 cenários Meta é estrutural e verdadeira (COGS Meta zero, sem subsídio escondido no desenho; vigiar 2 vazamentos: absorver fatura Meta de cliente "para destravar canal" e o LLM institucional não atribuído). A R$ 0,12/conversa o blend de 50 clientes dá 72,8% (cheio) a 80,4% (típico); a R$ 0,25 cai a 68,1% (recuperável com franquias -20%); ao custo ATUAL o modelo renderia ~21% com Scale e Founders negativos.

1. [CONFIRMA] Tabela de margem 7.4: as 8 células de custo/margem reproduzem ao décimo a partir das premissas declaradas.
2. [AJUSTAR] Growth Founders: taxa de 3% calculada sobre R$ 497 em vez de R$ 347,90. Correto: 57,3% cheia / 71,1% típica (melhor que o publicado).
3. [AJUSTAR] Falta o preço ANUAL (-20%): Growth anual cheio 62,3%, Scale anual cheio 59,8% (abaixo de 70). Declarar que a meta vale para mensal cheio ou incluir linhas anuais. O único pagante real é anual.
4. [AJUSTAR] Sensibilidade: a R$ 0,45 o Growth cheio cai a 2,8% (não ~6%); break-even LLM do Growth cheio = R$ 0,4641/conversa.
5. [AJUSTAR] Custo LLM "hoje ~R$ 0,75/conversa" não é demonstrado: medido é R$ 0,0726/CHAMADA (tenant, jul); por conversa depende de chamadas/conversa não medidas (R$ 1,40 a 5,14 nos recortes disponíveis). Tratar como faixa R$ 0,5 a 5 até a sombra medir.
6. [AJUSTAR] Meta R$ 0,12: sai por um triz (R$ 0,125) com 1 chamada/resposta e SEM verificação; com verificação seletiva em 30% vai a ~R$ 0,16. Medir P90 e chamadas/resposta, impor teto de chamadas de verificação. Pior caso fair use hoje: R$ 3,63/conversa.
7. [CONFIRMA] Fatura Meta do cliente: os 6 números reproduzem exatamente (5,5 msgs × 60%). Ressalva: janela de 90 dias mostra 7,4 msgs/conversa (+35% nas faturas se persistir).
8. [AJUSTAR] Rótulo errado no anexo 7 linha 66: R$ 35 é cenário A, não B.
9. [AJUSTAR] Tetos default do Cost Guard ficam ABAIXO da fatura típica em B/C (Growth: teto 150 vs fatura 165/264; Scale: 500 vs 577/924): "zero surpresa" vira estrangulamento no meio do mês. Indexar o teto a 1,5x a fatura típica projetada pela tabela oficial de 01/09.
10. [CONFIRMA c/ ressalva] TCO vs Blip Go: headline vence (147 < 179,90); TCO empata no cenário A (R$ 180,42 vs 179,90) e perde 13% no C. Blip Go também será atingido pela tarifa; se absorver, o flanco vira features, não TCO.
11. [AJUSTAR] "Custa menos que o token do MBA": verdade no Growth+ (break-even ~500 clientes/mês), FALSO no Lite típico (MBA R$ 214-267 vs ZappIQ R$ 282-326). Restringir a copy ao carro-chefe.
12. [REFUTA parcial] Margem dos packs: a R$ 0,12 só o +100 passa de 70% (72,5%; +250 dá 66,7%; +1.000 dá 56,9%); a R$ 0,25 o +1.000 dá 13,4% (break-even R$ 0,29, dentro da faixa admitida pelo gate). Vender packs só pós-gate ou reprecificar.
13. [REFUTA] Incentivo perverso comprovado: Essencial + pack 250 (R$ 246/400 conversas) domina o Lite (R$ 247/300); Growth + packs (R$ 1.293) bate o Scale (R$ 1.497) pelas mesmas 3.500 conversas; pack a R$ 0,299 fica abaixo do piso do atacado Partner (R$ 0,30-0,40). Correção: máx. 2 packs/mês (depois força upgrade) e reprecificar +250 -> R$ 119, +1.000 -> R$ 399.
14. [CONFIRMA] Essencial é o plano mais robusto (break-even LLM R$ 0,87 cheio; R$ 1,45 típico); a escada de preço/conversa (0,98 -> 0,82 -> 0,50 -> 0,43) sustenta upsell; quem canibaliza o Lite é o pack, não o Essencial. Fragilidade em ordem: Growth Founders (0,32) < Scale (0,41) < Growth (0,46) < Lite (0,75) < Essencial (0,87).
15. [CONFIRMA condicionado] Blend 50 clientes (30/12/6/2): receita R$ 13.350, margem 80,4% típica / 72,8% cheia a 0,12; 68,1% a 0,25; ~21% ao custo atual. Declarar o LLM institucional (~R$ 351/mês ≈ 2,6 p.p.) como overhead no blend.
16. [AJUSTAR] Taxas 3% só com mix Pix/boleto; cartão Stripe BR ≈ 4,26% no ticket de R$ 147 (-1,3 p.p. na tabela toda). Declarar premissa de mix.

### S1 · Agente 3: advogado do diabo econômico (concluído 20/08)

16 ataques; 3 furos mais perigosos em ordem:
1º MARGEM É APOSTA NÃO PROVADA COM TETO CONTRATUAL FURADO (ataques 13+1): a redução de LLM 6x (R$ 0,75 -> 0,12) não existe ainda e será "medida" numa amostra de 1 org; o único dado real aponta R$ 1,30 a 4,90/conversa; e o fair use de 25 respostas autoriza contratualmente custo 5x a premissa (Growth de suporte pesado: margem -60% MESMO passando o gate, porque o gate mede média e o furo é a cauda). Correção: gate por RESPOSTA (<= R$ 0,03), benchmark sintético por vertical (replay de 1.000 conversas), P90 e teto de chamadas de verificação, circuit breaker por org (custo > 2x premissa -> modo econômico automático, em contrato), fair use 12 até o roteamento provado, no-go com página alternativa pronta.
2º O FUNIL DE WHATSAPP MORRE NO CARTÃO DA META (ataque 5): a partir de 01/10 o canal exige cartão + verificação de empresa num terceiro no meio do onboarding; caso base empírico é 100% de falha (CMJ, 30 dias travada); conversão self-service despenca para um dígito. Correção: dia 0 no webchat + número de teste (Iza com os dados do cliente em minutos, sem WABA), trial por ativação (relógio começa na 1ª conversa real), go-live de WABA como concierge de 15 min, monitor vira bloqueio visível, crédito CAC "1ª fatura Meta até R$ 50 por nossa conta".
3º TETOS DEFAULT ABAIXO DA FATURA DA FRANQUIA VENDIDA (ataque 8): Lite 50 vs 57,75; Growth 150 vs 192,50; Scale 500 vs 673,75 (franquia cheia, tarifa atual); Growth com novembro forte emudece antes da Black Friday. Correção: teto derivado (franquia cheia × tarifa vigente × 1,3, recalibrado em 01/09), escolha obrigatória no onboarding, soft-stop default com 1 clique e carência de 48h, hard-stop opt-in, modo pico agendável, nunca cortar conversa aberta.

Demais ataques que exigem mudança: (2) "1 conversa = 1 cliente/mês" é falso no cliente recorrente e a própria Conta Clara expõe (renomear unidade para ATENDIMENTO com fechamento por 72h de inatividade; simulador traduz por vertical); (3) spam/grupos/webchat anônimo drenam franquia (interação bidirecional mínima, anti-velocity, CAPTCHA/rate-limit no webchat, grupos fora do contrato até precificar, botão "não era cliente" com crédito <= 10%/mês); (4) custo de ENTRADA sem teto (40 áudios/dia ≈ R$ 37 de STT; cota de minutos de áudio + degradação + teto de tokens de contexto); (6) Essencial pode virar o centro de gravidade (50-70% da base alvo cabe nele para sempre; MRR -31% no mix; lançar com gates duros, não listado, KPI de canibalização com kill-switch); (7) packs abaixo do upgrade e do atacado (reprecificar +100/R$ 69, +250/R$ 149, +1.000/R$ 449; regra escrita varejo > atacado > custo; máx. 2 packs/mês); (9) webchat não persiste mensagem e o único pagante é webchat-only (persistência ANTES de 08/09, senão a sombra nasce cega); (11) atacado Partner a 0,30-0,40 vende abaixo do custo no cenário realista com seleção adversa (por resposta R$ 0,08-0,10 ou piso 0,50 com fair use 15; MAP); (12) transparência perde a fase da planilha (simulador mostra a linha Meta TAMBÉM no concorrente + garantia de fatura total do 1º mês limitada pelo teto); (14) franquia anunciada é ficção até dezembro e o trial é LLM grátis sem cadeado (hard cap 2x para contas novas desde 01/10; cap de trial ressuscitado; modelo leve em trial; e-mails de setembro rotulados como simulação); (15) se a Meta mudar de novo, sobrevive a arquitetura, morre a narrativa (3 variantes do kit pré-escritas; 50% do marketing segurado até 01/09; comparativo TCO vs MBA antecipado para Q4); (16) multi-balão gasta o dinheiro do cliente (balão único como PADRÃO desde o dia 1; follow-ups opt-in com custo exibido). RESISTE: migração de tráfego para webchat é boa para o caixa (transformar em feature "Economia Guiada").

### S1 · CONSOLIDAÇÃO (20/08)

Critério da sessão ("margem >= 70% nos 3 cenários sem subsídio escondido"): **APROVADO COM CONDIÇÕES**. A invariância da margem aos cenários de tarifa Meta é estrutural e foi confirmada aritmeticamente. As condições viraram correções aplicadas ao plano (ver "Mudanças aplicadas"): unidade renomeada para atendimento (72h), fair use inicial 12, gate D4 reformulado (por resposta, benchmark sintético, fator de segurança), packs reprecificados (69/149/449, máx. 2/mês), tetos derivados com soft-stop, pacote de funil dia-0 sem WABA, persistência do webchat como pré-requisito, hard cap 2x para contas novas, Founders com fee corrigido e regra pós-2027, changelog da grade declarado, copy do MBA restrita ao Growth+, contingência com 3 variantes do kit. Pendências que passam à S2 (técnica): viabilidade e sequência de PRs do pacote ampliado; à S3: simulador comparativo, battle-card e garantia de fatura; à S4: teste de consistência da versão editada.

## Mudanças aplicadas ao plano

- 20/08, pós-S1 (13 correções, detalhadas no "Adendo S1" do plano): unidade renomeada para ATENDIMENTO de IA (fechamento por 72h) com fair use inicial 12; gate D4 por resposta (<= R$ 0,03) via benchmark sintético com P90 e no-go escrito; packs reprecificados 69/149/449 com máximo 2/mês; tetos do Cost Guard derivados (franquia × tarifa × 1,3) com soft-stop e modo pico; funil dia-0 sem WABA no pacote inadiável (número de teste, trial por ativação, concierge, crédito CAC); persistência do webchat como pré-requisito; cadeados de custo (hard cap 2x, cap de trial, circuit breaker); changelog da grade declarado (Growth mantém 2º número, Scale mantém 15); Founders com fee corrigido (57,3/71,1) e regra pós-2027; margens anuais declaradas; copy do MBA restrita ao Growth+; "ninguém se posicionou" reescrito; claim de WABA sem billing rebaixado a inferência; simulador comparativo + garantia de fatura; e-mails rotulados como simulação; contingência com 3 variantes do kit; atacado Partner por resposta ou piso 0,50; blend com overhead institucional e mix de pagamento.
