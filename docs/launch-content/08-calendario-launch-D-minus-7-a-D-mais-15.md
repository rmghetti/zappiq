<!--
Canal: Documento operacional interno
Autor: Rodrigo Ghetti
Versão: 1.0
Escopo: D-7 (17/abr) até D+15 (09/mai)
D-Day: 24 de abril de 2026 (sexta-feira)
-->

# Calendário executivo de launch · D-7 a D+15

Janela completa do soft-launch ao estabilização pós-launch. Este calendário é operacional — cada linha tem responsável atribuído e objetivo mensurável. Ajustar conforme métrica real do dia anterior.

## Legenda de responsáveis

- **R** = Rodrigo Ghetti (fundador)
- **AG** = Agência/terceiro (a contratar ou via rede)
- **AUTO** = Automação da plataforma (e-mail worker, scheduler)

## Legenda de objetivos

- **TRIAL** = gerar trials novos
- **LEAD** = capturar leads qualificados (pricing downloads, ROI calc, etc.)
- **SEO** = autoridade de domínio, tráfego orgânico de médio prazo
- **BRAND** = construção de posicionamento, engajamento de rede
- **OPS** = validação operacional, sem objetivo comercial direto

## Tabela

| Data          | Dia    | Canal              | Ativo                                                                 | Responsável | Objetivo |
|---------------|--------|--------------------|----------------------------------------------------------------------|-------------|----------|
| 17/abr (D-7)  | Sex    | E-mail 1:1         | Envio do convite beta para grupo 1 (10 nomes)                        | R           | TRIAL    |
| 18/abr (D-6)  | Sáb    | —                  | Off — resposta passiva a quem abriu o convite                         | R           | OPS      |
| 19/abr (D-5)  | Dom    | —                  | Off — buffer                                                          | —           | —        |
| 20/abr (D-4)  | Seg    | E-mail 1:1         | Envio do convite beta para grupo 2 (10 nomes)                        | R           | TRIAL    |
| 20/abr (D-4)  | Seg    | LinkedIn (teaser)  | Post curto sem link: "lanço na quinta. se você paga setup fee de IA, presta atenção." | R | BRAND |
| 21/abr (D-3)  | Ter    | LinkedIn           | **Post 01-founder-pitch** (Rodrigo, perfil pessoal)                  | R           | TRIAL    |
| 21/abr (D-3)  | Ter    | E-mail 1:1         | Envio do convite beta para grupo 3 (10 nomes)                        | R           | TRIAL    |
| 22/abr (D-2)  | Qua    | Ops                | Smoke test final em staging + dry-run do Stripe webhook              | R           | OPS      |
| 22/abr (D-2)  | Qua    | LinkedIn           | Comentário em thread de ex-colega do setor comentando o mercado     | R           | BRAND    |
| 23/abr (D-1)  | Qui    | Imprensa           | Disparo do press release para 15 jornalistas com embargo quinta 9h  | R ou AG     | BRAND    |
| 23/abr (D-1)  | Qui    | E-mail embaixadores| Envio do kit-embaixadores para os 8 beta testers convertidos         | R           | TRIAL    |
| 23/abr (D-1)  | Qui    | Ops                | Última verificação: DNS, Stripe live mode, Resend production         | R           | OPS      |
| **24/abr (D)**| **Sex**| **Blog + Landing** | **Publicação blog "Setup fee é fraude intelectual" + landing live**| **R**       | **TRIAL/SEO** |
| 24/abr (D)    | Sex    | LinkedIn           | Post principal do founder + 8 embaixadores replicando em janela 12-18h | R + rede | TRIAL    |
| 24/abr (D)    | Sex    | Twitter/X          | Thread com os 6 pontos do blog                                       | R           | BRAND    |
| 24/abr (D)    | Sex    | E-mail newsletter  | Disparo para lista de waitlist capturada em pré-launch               | R ou AUTO   | TRIAL    |
| 25/abr (D+1)  | Sáb    | Métrica            | Review de conversão D+0 — meta: 40 trials no primeiro dia            | R           | OPS      |
| 26/abr (D+2)  | Dom    | —                  | Off                                                                   | —           | —        |
| 27/abr (D+3)  | Seg    | LinkedIn           | **Post 02-technical-deep-dive** (Rodrigo)                            | R           | LEAD     |
| 27/abr (D+3)  | Seg    | E-mail AUTO        | Primeiro disparo `trial:D3` para trials do D-0                       | AUTO        | TRIAL→PAGO |
| 28/abr (D+4)  | Ter    | Ads (opcional)     | Ligar Google Ads em termos "plataforma IA WhatsApp" (budget R$ 100/dia) | R ou AG  | TRIAL    |
| 29/abr (D+5)  | Qua    | LinkedIn           | **Post 03-comparison-table**                                         | R           | LEAD     |
| 30/abr (D+6)  | Qui    | Webinar ao vivo    | "Como treinar IA do WhatsApp sem consultor" — 45 min + QnA           | R           | TRIAL    |
| 01/mai (D+7)  | Sex    | Blog               | Segundo artigo: "AI Readiness Score explicado — o que cada ponto representa" | R   | SEO      |
| 01/mai (D+7)  | Sex    | Métrica            | **GO/NO-GO review** com base no GO-NO-GO-CHECKLIST.md                | R           | OPS      |
| 04/mai (D+10) | Seg    | E-mail AUTO        | Disparo `trial:D10` para trials do D-0                               | AUTO        | TRIAL→PAGO |
| 05/mai (D+11) | Ter    | LinkedIn           | Post de resultados parciais (se houver métrica publicável)           | R           | BRAND    |
| 07/mai (D+13) | Qui    | Podcast            | Gravação em podcast de SaaS brasileiro (pré-agendar em D-14)         | R           | BRAND    |
| 08/mai (D+14) | Sex    | E-mail AUTO        | Primeiro disparo `trial:lastDay` para trials do D-0 que não converteram | AUTO    | TRIAL→PAGO |
| 08/mai (D+14) | Sex    | Blog               | Terceiro artigo: análise de dados do primeiro trial grátis completo  | R           | SEO      |
| 09/mai (D+15) | Sáb    | Métrica + retro    | Retrospectiva com números reais + decisão sobre próximo sprint       | R           | OPS      |

## Notas operacionais

- **Ajustes de rota permitidos:** se métrica D+1 indicar conversão abaixo de 20%, antecipar Post 03 para D+2 em vez de D+5. Se estiver acima, segurar.
- **Ads só depois de orgânico validado:** não ligar Google Ads antes de D+4 mesmo se tráfego estiver baixo. Queremos saber o CAC orgânico puro antes de misturar canal pago.
- **Webinar D+6:** se inscritos < 30 em D+4, transformar em mini-podcast gravado (baixo risco de evento vazio).
- **E-mails automáticos do trial:** cadeira AUTO depende do worker BullMQ estar rodando + Resend configurado. Se algum falhar, reverter para disparo manual via `POST /api/savings-email/dispatch`.
