# ZappIQ — Estratégia de Pricing e Plano Enterprise

## Contexto executivo

ZappIQ atua no mercado B2B SaaS de comunicação conversacional inteligente via WhatsApp. O pricing atual cobre PME (Starter R$297, Growth R$597, Scale R$997). Falta posicionamento para médias/grandes empresas que exigem SLA formal, observabilidade avançada, suporte dedicado e conformidade LGPD auditável.

Este documento define o plano Enterprise e o produto Observabilidade (Radar 360°) como add-on para demais planos.

---

## Plano Enterprise — R$ 2.997/mês (base, custom quote)

### Posicionamento

Tier premium para empresas com >50 colaboradores ou >R$10M de faturamento, que tratam WhatsApp como canal estratégico e precisam de SLA contratual, observabilidade profunda, suporte 24/7 e garantias LGPD auditáveis.

### Target ICP (Ideal Customer Profile)

- Empresas com áreas de compliance ativas (bancos, saúde, educação superior, serviços B2B regulados)
- Operações com >5.000 conversas/mês
- Clientes com múltiplas unidades ou filiais
- Empresas que já possuem ou estão montando SAC 2.0 / Customer Experience estruturado
- Operações que exigem DPO interno ou terceirizado com contato direto ao fornecedor

### Funcionalidades incluídas

**Capacidade ilimitada (vs Scale)**
- Agentes ilimitados
- Mensagens de IA ilimitadas (Pulse AI)
- Disparos ilimitados (Spark Campaigns)
- Contatos ilimitados (Nexus CRM)
- Fluxos ilimitados (Forge Studio)
- Usuários administrativos ilimitados
- Integrações ilimitadas

**SLA contratual 99,9%** (ver `docs/SLA.md`)
- Uptime mensal garantido
- Créditos automáticos em caso de descumprimento (10% / 25% / 50% conforme tier de falha)
- Relatório mensal de uptime
- RPO 1h / RTO 4h formalmente contratados

**Observabilidade Radar 360° incluída** (ver seção Observabilidade abaixo)
- Valor equivalente a R$ 397/mês — incluso no plano
- Acesso a BI com dados brutos
- Alertas customizados
- Exportação para Power BI / Looker

**SOC/NOC Dedicado 24/7**
- Monitoramento proativo da sua operação (não só da infraestrutura)
- Time técnico acompanhando métricas de negócio em tempo real
- Escalation direto para engenharia ZappIQ em P1/P2
- Runbook de incidente customizado para sua operação

**Onboarding white-glove (30 dias)**
- Project Manager dedicado
- Arquiteto de Soluções dedicado
- Treinamento presencial ou remoto para até 20 colaboradores
- Migração assistida de plataformas anteriores
- Go-live com acompanhamento 24/7 nos primeiros 7 dias

**Gerente de Sucesso Dedicado**
- Cadência semanal nos primeiros 3 meses
- Cadência quinzenal em regime normal
- Revisão trimestral de uso e ROI (QBR)
- Acesso a roadmap do produto e influência de prioridades

**Conformidade LGPD Enterprise**
- Contato direto com DPO ZappIQ
- ROP customizado para sua operação
- SLA de 48h para atendimento a DSR (Data Subject Requests)
- Auditoria completa anual com certificado
- Suporte a contratos DPA (Data Processing Agreement)
- Contrato customizado de confidencialidade

**Retenção customizada**
- Logs de auditoria até 5 anos (regulados) vs padrão 1 ano
- Backup customizado (frequência + retenção sob demanda)
- Point-in-time recovery dedicado

**Infraestrutura isolada**
- Connection pool dedicado no Postgres
- Queue BullMQ dedicada (sem contenção com outros clientes)
- Rate limits de API elevados (10x do padrão)
- Namespace RAG isolado com quota dedicada

**Suporte 24/7 multicanal**
- Telefone dedicado
- WhatsApp prioritário
- Chat em tempo real
- E-mail com SLA de 2h em business hours, 4h fora
- PagerDuty escalation para P1/P2

**Integrações customizadas**
- Desenvolvimento sob medida (até 40h/mês inclusas)
- Conectores para ERPs legados
- Webhooks customizados com retry policy específica
- Single Sign-On (SAML 2.0, OIDC)

### Pricing Enterprise — modelo

| Item                       | Valor                  |
|----------------------------|------------------------|
| **Base mensal**            | R$ 2.997/mês           |
| **Setup fee (one-time)**   | R$ 9.997 (waivable em contrato anual) |
| **Desconto anual**         | 15% (R$ 30.567/ano)    |
| **Desconto 2 anos**        | 25% (R$ 53.946 total)  |
| **Dev customizado extra**  | R$ 250/hora após 40h/mês inclusas |
| **Treinamento adicional**  | R$ 2.500/dia (após onboarding) |

**Racional do preço:**
- Starter a R$297 serve solo/PME (2–5 colaboradores)
- Growth a R$597 serve PME (5–15 colaboradores)
- Scale a R$997 serve PME+ (15–50 colaboradores)
- Enterprise a R$2.997 serve 50+ colaboradores, representa **3x Scale** para refletir o valor incremental de: SLA contratual (~R$500 de valor), Radar 360° (R$397), SOC/NOC dedicado (~R$800), onboarding white-glove (amortizado), CSM dedicado (~R$600), integrações customizadas (~R$400)
- Markup saudável: margem bruta target de 70% neste tier

**Benchmarks de mercado (validação):**
- Octadesk Enterprise: ~R$ 1.800–3.500/mês
- Huggy Ultra: sob consulta, ~R$ 2.500+/mês
- Zendesk Suite Enterprise: US$ 150+/agente/mês (>R$ 3.000 para 5 agentes)
- Hubspot Service Hub Enterprise: US$ 1.200/mês base

ZappIQ Enterprise a R$2.997 se posiciona **competitivo e premium**, acima de concorrentes BR mas com diferencial de IA nativa + LGPD auditável.

### Como vender (playbook comercial)

**Gatilhos que qualificam para Enterprise:**
1. Cliente menciona "compliance", "auditoria", "LGPD", "DPO", "ISO 27001"
2. Operação com >10 atendentes
3. Volume >5.000 conversas/mês
4. Necessidade de SLA formal (contrato, SLA penalty)
5. Integrações com ERP/CRM/ BI já existentes
6. Múltiplas unidades/filiais/marcas no mesmo CNPJ
7. Setores regulados: financeiro, saúde, educação, jurídico, varejo de luxo

**Pitch de 30 segundos:**
> "O Enterprise é pra operações que tratam conversação como canal estratégico. Além de tudo ilimitado, você tem SLA contratual de 99,9%, observabilidade que vira decisão de negócio (Radar 360°), time técnico dedicado 24/7 monitorando sua operação, onboarding com arquiteto dedicado e conformidade LGPD auditável com DPO direto. É pra quem não pode parar e precisa responder pra auditoria."

**Objeções e respostas:**

| Objeção                                      | Resposta                                                                                                                             |
|----------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------|
| "R$2.997 é caro"                             | "Custo de 1 atendente júnior é R$3.500 + encargos. Enterprise substitui 3–5 atendentes e ainda te dá SLA e BI. Payback em 30 dias." |
| "Já temos Octadesk/Huggy"                    | "Qual a sua taxa de resposta do fornecedor em incidente P1? O nosso é 15min e tem SLA contratual. Faça uma auditoria interna."       |
| "Não precisamos de SLA formal"               | "Seu time de compliance precisa, ou vai precisar. Vale preparar antes da auditoria que cada vez vem mais cedo."                      |
| "Tem desconto?"                              | "15% anual, 25% em 2 anos, setup fee waivable em contrato anual. Desconto fixo mensal não fazemos — comprometeria o nível de serviço." |

---

## Observabilidade como produto — Radar 360°

### Posicionamento

**"Transforme conversas em decisões de negócio. Não adivinhe o que está funcionando — saiba."**

Radar 360° é o produto de BI conversacional da ZappIQ. Enquanto o Radar Insights (nativo dos planos) dá métricas operacionais básicas (mensagens, tempo médio, conversão simples), o Radar 360° entrega inteligência de negócio acionável: cohort analysis, previsão de pipeline, benchmarking, alertas proativos e exportação para ferramentas de BI.

### Funcionalidades do Radar 360°

**1. Dashboards executivos customizáveis**
- 20+ widgets drag-and-drop (conversão, NPS conversacional, receita por canal, SLA por agente)
- Branding do cliente (logo, cores)
- Compartilhamento por link público com senha (opcional)
- Export PDF agendado (relatório semanal/mensal automático por e-mail)

**2. Cohort Analysis**
- Retenção de leads por mês/trimestre de entrada
- Comportamento comparado entre segmentos de clientes
- Taxa de conversão por origem de lead (WhatsApp direto, site, redes sociais)
- LTV estimado por cohort

**3. Funil de Conversão Multicamada**
- Visibilidade completa do funil: primeiro contato → qualificação → proposta → fechamento
- Taxa de drop-off em cada etapa
- Tempo médio em cada estágio
- Identificação de gargalos automática

**4. Alertas Proativos Inteligentes**
- "Queda anormal de conversão" (detectado via desvio padrão histórico)
- "Pico de abandono em horário específico" (ex: 18h-19h)
- "Agente X com performance fora da média" (positiva ou negativa)
- "Palavra-chave emergente em conversas" (ex: "concorrente", "cancelar")
- Integração com Slack, WhatsApp e e-mail

**5. Previsão de Pipeline (ML)**
- Forecast de fechamento baseado em padrões históricos
- Probabilidade de conversão por conversa ativa
- Alerta de leads "em risco" (caindo em engajamento)
- Sugestão de próxima ação por lead (baseada em padrões de sucesso)

**6. Benchmarking de Mercado**
- Comparação anônima contra média do seu segmento (varejo, saúde, educação, etc.)
- Percentil de performance em métricas chave
- Identificação de oportunidades ("você está no P25 em tempo de resposta")

**7. Heatmap Operacional**
- Mapa de calor de volume por hora/dia
- Identificação de horários ótimos para campanhas
- Distribuição de carga por agente

**8. BI Exportável**
- Conector Power BI (OData feed)
- Conector Looker Studio
- Export CSV/Excel agendado
- API REST para pipeline de dados próprio

**9. Observabilidade Técnica do Negócio**
- SLA por agente (tempo de 1ª resposta, tempo de resolução)
- Taxa de transferência humana vs IA
- Qualidade de resposta do Pulse AI (avaliação manual + automática)
- Eficiência de campanhas (taxa de conversão por template)

**10. Integração com OTel / Traces**
- Rastreamento end-to-end de conversa (útil para debug de fluxos complexos)
- Latência de resposta IA (detecta degradação antes do cliente perceber)

### Pricing Radar 360°

| Plano base | Preço Radar 360° add-on | Total com add-on |
|------------|--------------------------|-------------------|
| Starter    | **R$ 197/mês**           | R$ 494/mês        |
| Growth     | **R$ 197/mês**           | R$ 794/mês        |
| Scale      | **R$ 397/mês**           | R$ 1.394/mês      |
| Enterprise | **Incluso**              | R$ 2.997/mês      |

**Racional do preço:**
- Radar 360° entrega ~20–30 horas/mês de trabalho analítico equivalente (analista sênior BI custa R$8k–15k/mês)
- Preço R$197–397 representa fração pequena do valor entregue
- Starter/Growth compartilham preço R$197 porque em volume pequeno o valor de insights é similar
- Scale sobe para R$397 porque volume maior = mais dados = mais insights (e cliente tem mais capacidade de pagar)
- Enterprise inclui por padrão — é parte da proposta de valor do tier

### Upgrade path comercial

- **Gatilho de oferta:** cliente Scale com >10.000 conversas/mês por 3 meses consecutivos → oferecer trial 14 dias do Radar 360°
- **Gatilho Enterprise:** Scale com Radar 360° ativo por >6 meses + indicação de necessidade de SLA → oferecer upgrade Enterprise
- **Estratégia de demo:** preparar 3 dashboards de exemplo do Radar 360° com dados anônimos, oferecer em todo pitch comercial

### Pitch de venda Radar 360°

> "O Radar 360° é o produto que transforma o WhatsApp de canal de atendimento em fonte de inteligência de negócio. Você para de tomar decisão no achismo. Descobre que 40% dos seus leads caem entre a segunda e terceira mensagem. Descobre que seu melhor agente tem 3x mais conversão às 10h vs às 16h. Descobre que 60% dos clientes que mencionam a palavra 'concorrente' cancelam em 30 dias. Isso não é dashboard bonito — é margem e crescimento."

---

## Roadmap de implementação

### Fase 1 — Agora (pré-piloto)
1. Atualizar landing page com plano Enterprise, Radar 360° add-on, seção LGPD, seção SLA ✓
2. Criar páginas dedicadas: `/enterprise`, `/observabilidade`, `/lgpd`, `/sla` ✓
3. Criar material comercial: one-pager Enterprise, deck de pitch ✓
4. Atualizar FAQ ✓

### Fase 2 — Durante piloto (próximos 30–60 dias)
1. Coletar uso real dos clientes piloto
2. Validar se Radar 360° é diferencial percebido
3. Ajustar pricing se necessário (tolerância ±20%)
4. Criar case studies dos pilotos

### Fase 3 — Pós-piloto (lançamento público)
1. Publicar SLA formalmente (documento versionado)
2. Publicar relatórios de uptime mensais (status.zappiq.com.br)
3. Campanha de lançamento com foco em LGPD + Enterprise
4. Habilitar self-service para Scale; Enterprise sempre sales-led

---

## KPIs de sucesso

| Métrica                              | Target 6 meses | Target 12 meses |
|--------------------------------------|----------------|-----------------|
| % clientes Enterprise do MRR total   | 15%            | 30%             |
| ARPA (receita média por conta)       | R$ 900         | R$ 1.500        |
| Taxa de adoção Radar 360° (Scale)    | 25%            | 50%             |
| NPS Enterprise                       | >60            | >70             |
| Churn Enterprise anual               | <5%            | <3%             |
| Payback de CAC Enterprise            | <12 meses      | <8 meses        |

---

## Competitive intelligence

| Concorrente   | Enterprise (mês) | SLA formal | BI/Observ. | LGPD auditável | Nativo IA |
|---------------|------------------|------------|------------|----------------|-----------|
| **ZappIQ**    | R$ 2.997         | ✓ 99,9%    | ✓ Radar 360° | ✓             | ✓         |
| Octadesk      | ~R$ 1.800–3.500  | ~           | ~           | ~              | add-on    |
| Huggy         | sob consulta     | ~           | ~           | ~              | add-on    |
| Zendesk       | R$ 3.000+        | ✓          | ✓           | ✓              | add-on    |
| Hubspot       | R$ 6.000+        | ✓          | ✓           | parcial (US)   | add-on    |

**Nossa narrativa competitiva:** "Todos são plataforma de atendimento. A gente é plataforma de inteligência conversacional, nativa brasileira, com LGPD no core e SLA de gente grande pelo preço de PME."
