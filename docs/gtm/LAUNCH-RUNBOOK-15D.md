# ZappIQ — Runbook de Lançamento em 15 dias

**Premissa:** launch 100% digital, founder-led, sem time de vendas. Go-live com confiança técnica e operacional, tração de signups no D+3 pós-launch e primeiras assinaturas no D+10.

---

## Fase 0 — Pré-lançamento técnico (D-15 a D-11)

### D-15 · Congelamento de escopo
- Fechamento da release 2026.04 (Sprint Launch).
- Código fora do trilho `main` só com hotfix autorizado.
- Branches `release/2026.04` criadas em `apps/api`, `apps/web`, `packages/shared`.

### D-14 · Migration + deploy staging
- Rodar `prisma migrate deploy` em staging (inclui `tenant_usage_monthly`, `qa_pairs`, campos de trial + AI Readiness na `organizations`).
- Smoke test de onboarding completo + upload de documento + criação de Q&A + consulta de status.
- Validar que `aiReadinessScore` atualiza após cada mutação.

### D-13 · Bootstrap Stripe
- Executar `pnpm tsx scripts/setup-stripe-products.ts` em ambiente **test** do Stripe.
- Revisar o JSON retornado e colar em `STRIPE_PRICE_IDS` do staging.
- Simular trial → upgrade Starter → upgrade Growth.
- Confirmar webhook `/api/stripe/webhook` processa eventos corretamente.

### D-12 · Observabilidade end-to-end
- Conferir que métricas `zappiq_llm_*`, `zappiq_conversation_*`, `zappiq_agent_pipeline_*` chegam no Prometheus.
- Dashboards Grafana: `Unit Economics`, `Conversational Funnel`, `LLM Cost & Latency`, `AI Readiness Adoption`.
- Alertas ativos: custo LLM/hora > US$ 20, handoff rate > 25%, p95 pipeline > 5s, error rate > 2%.

### D-11 · Auditoria LGPD + SLA
- Checklist `docs/LGPD-ROP.md` revisado e assinado.
- Revisão do `docs/SLA.md` por direito societário (parceiro jurídico externo).
- Páginas públicas `/lgpd`, `/sla`, `/selo-zappiq` revisadas ortograficamente.

---

## Fase 1 — Pré-lançamento comercial (D-10 a D-6)

### D-10 · Landing review
- Hero novo (você treina sua IA, sem setup fee, 14 dias grátis).
- Seção `SelfServiceTraining` com score simulado 72/100.
- Comparativo competitivo com setup fees dos concorrentes.
- ROI Calculator configurado com preços reais.
- Pixel Meta + GA4 + Hotjar + Clarity instalados.
- Google Search Console verificado + sitemap submetido.

### D-9 · Conteúdo seed
- 3 posts no blog:
  - "Quanto custa treinar a IA do seu WhatsApp? R$ 0 na ZappIQ."
  - "O preço escondido das plataformas de chatbot tradicionais"
  - "Checklist: a IA do seu atendimento está pronta? (com Readiness Score)"
- 1 case study (mesmo que sintético em V1 — ajustar copyrights depois).
- 1 e-book lead magnet: "Manual do self-service AI training".

### D-8 · Campanhas pagas
- Google Ads — 3 grupos: [chatbot whatsapp preço], [automação whatsapp b2b], [alternativa blip|huggy|zenvia].
- Meta Ads — 2 campanhas: retargeting landing + lookalike de leads do e-book.
- LinkedIn Ads — targeting por cargo (CMO, diretor comercial, CX leader) em indústrias ICP.
- Budget diário: R$ 300 Google / R$ 200 Meta / R$ 250 LinkedIn = R$ 750/dia.

### D-7 · Orgânico
- 10 posts LinkedIn fundador sobre: setup fee vs self-service, unit economics, transparência.
- 5 posts Instagram (carrossel) sobre casos de uso por segmento.
- 3 vídeos curtos (60s) de demonstração da plataforma (pode usar Loom).

### D-6 · Parcerias + afiliados
- Lançar programa de afiliados (10% recorrente).
- Contato com 20 consultores digitais / agências parceiras.
- Lista de 5 influenciadores do nicho B2B brasileiro para co-marketing.

---

## Fase 2 — Semana de lançamento (D-5 a D0)

### D-5 · Beta privado encerrado
- Comunicar aos beta users: "Obrigado. Público em 5 dias. Vocês têm cupom VIP 30% vitalício."
- Coletar depoimentos em vídeo/texto (mesmo que curtos).
- Publicar 3 depoimentos na landing em destaque.

### D-4 · Dry-run completo
- Test drive do fluxo: visitante → landing → register → onboarding → AI training → conectar WhatsApp → primeira conversa real.
- Medir latência, falhas, pontos de fricção.
- Fixar o que for P0/P1.

### D-3 · Sinal verde técnico
- Health check: api, web, rag-service, redis, postgres, observabilidade.
- Rollback plan documentado em `RUNBOOK-INCIDENT.md`.
- Pager rotation cadastrada (fundador + 1 desenvolvedor plantonista).

### D-2 · Comunicação pré-launch
- LinkedIn post fundador: "Lança quarta."
- E-mail para a lista (leads do e-book + beta users): "Lança quarta. Cupom para primeiras 50 assinaturas."
- Teaser no Instagram / Stories.

### D-1 · Ativar campanhas pagas
- Google Ads ligado.
- Meta Ads ligado.
- LinkedIn Ads ligado.
- Monitorar custo por clique e ajustar lances nas primeiras 4h.

### D0 · LAUNCH DAY
- **08:00** — Post de lançamento no LinkedIn do fundador.
- **08:15** — E-mail para lista.
- **08:30** — Post Instagram + Stories.
- **09:00** — Envio de DM para 30 contatos ICP próximos (warm outreach manual).
- **12:00** — LinkedIn live de 30 min demonstrando a plataforma ao vivo.
- **15:00** — Anúncio no Product Hunt (agendar madrugada PT 00:01 do dia seguinte).
- **18:00** — Retrospectiva do dia: signups, CAC blended, onde travou.

---

## Fase 3 — Pós-lançamento (D+1 a D+15)

### D+1 a D+3 · War room
- Daily 30 min com desenvolvedor plantonista.
- Revisão de métricas em tempo real (signups, trial activations, erros).
- Resposta a qualquer incidente em < 1h.

### D+3 · Primeira otimização
- Analisar funil: onde o visitante trava? Onde o trial engaja?
- A/B test do hero (headline alternativo).
- Ajuste de copy da seção self-service baseado no CTR.

### D+5 · Primeira análise de conversão
- Quantos trials? Quantos chegaram a AI Readiness ≥ 60?
- Qual a taxa de ativação do Radar 360°, Q&A, upload de docs?
- Quais verticais estão convertendo mais?

### D+7 · Primeiro ciclo de vendas assistida
- Fundador entra em call com 10 trials que atingiram Score ≥ 60 mas não converteram.
- Entender fricções reais (preço, recurso faltando, dúvida sobre contrato).
- Ajustar copy / pricing / produto na próxima sprint.

### D+10 · Primeira assinatura paga esperada
- Se cumprirmos funil: ~100 trials × 40% de conversão dentre quem atinge Score 60 = 15–25 assinaturas pagas no D+10.
- Caso contrário, revisar CTAs, preço de entrada, clareza da mensagem.

### D+15 · Check-point executivo
- Relatório de KPIs com números reais.
- Decisão sobre:
  - Manter budget de ads atual, ampliar, ou realocar?
  - Abrir programa de indicação para clientes pagantes?
  - Iniciar vertical-specific landings (saúde, varejo, educação, serviços B2B)?
  - Contratar primeiro BDR full-time ou ainda não?

---

## Métricas críticas do launch

| KPI | D+7 | D+15 | D+30 |
|---|---|---|---|
| Visitantes únicos | 3.000 | 8.000 | 20.000 |
| Trials ativados | 120 | 350 | 900 |
| AI Readiness ≥ 60 | 60 | 180 | 480 |
| Assinaturas pagas | 5 | 25 | 90 |
| MRR (R$) | 3.000 | 18.000 | 75.000 |
| CAC blended | 700 | 600 | 500 |
| Churn mensal | — | — | < 4% |

---

## Regras de ouro (para o fundador)

1. **Não fazer call de vendas antes do visitante ver ROI Calculator e comparativo.** Se ele não engajou com o conteúdo, call vai ser educativa, não comercial.
2. **Não aceitar "desconto contra setup fee".** O storytelling é "zero setup fee". Dar desconto de mensalidade sim, quebrar o pilar não.
3. **Obsessão com o AI Readiness Score.** Todo trial que não atinge 60 em 7 dias é um problema de produto ou de UX, não de vendas.
4. **Observabilidade primeiro.** Nenhuma decisão de ads, preço ou mensagem sem olhar dashboard de unit economics.
5. **Resposta em < 2h em qualquer canal.** No launch, o fundador é a linha de suporte. Resposta rápida = conversão.
