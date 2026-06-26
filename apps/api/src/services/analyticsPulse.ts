/* ══════════════════════════════════════════════════════════════════════
 * Analytics "Pulso" (Fase 2) — motor de observabilidade narrada.
 * --------------------------------------------------------------------
 * 1. computeOrgDayMetrics  → snapshot diário por org em analytics_metric_daily
 * 2. detectAnomalies       → comparação determinística vs. baseline (z-score/limiar)
 * 3. narrateWithLLM        → a IA SÓ redige sobre os fatos (nunca inventa número)
 * 4. buildDeterministicNarrative → fallback garantido se a LLM cair/parse falhar
 * 5. generatePulseInsight  → orquestra e persiste 1 row em analytics_insights
 *
 * Padrões espelhados: queries no estilo de routes/analytics.ts (filtro explícito
 * por organizationId; o role de conexão em prod ignora RLS, que fica como defesa
 * em profundidade). LLM via llmRouter.complete() + logLLMCall (igual eval cron).
 * Fail-soft: nada aqui derruba o cron; erro de uma org não afeta as outras.
 * ══════════════════════════════════════════════════════════════════════ */

import { prisma } from '@zappiq/database';
import { logger } from '../utils/logger.js';
import { llmRouter } from './llm/LLMRouter.js';
import { logLLMCall } from './llm/llmCallAudit.js';

export type PulseSeverity = 'info' | 'attention' | 'critical';

export interface DayMetrics {
  date: string;
  messagesIn: number;
  messagesOut: number;
  botMessages: number;
  automationRate: number;
  newContacts: number;
  openConversations: number;
  closedConversations: number;
  avgFirstResponseMs: number | null;
  csatAvg: number | null;
  csatCount: number;
  sentimentPos: number;
  sentimentNeu: number;
  sentimentNeg: number;
  qualifiedLeads: number;
}

export interface Anomaly {
  metric: string;
  label: string;
  today: number;
  baseline: number;
  direction: 'up' | 'down';
  severity: PulseSeverity;
}

export interface PulseNarrative {
  title: string;
  narrative: string;
  severity: PulseSeverity;
  actions: Array<{ label: string; prompt: string }>;
  source: 'llm' | 'rule';
}

const SEVERITY_RANK: Record<PulseSeverity, number> = { info: 0, attention: 1, critical: 2 };

function maxSeverity(list: PulseSeverity[]): PulseSeverity {
  return list.reduce<PulseSeverity>((acc, s) => (SEVERITY_RANK[s] > SEVERITY_RANK[acc] ? s : acc), 'info');
}

/** Limites [start, end) do dia UTC de `ref` e a chave 'YYYY-MM-DD'. */
function dayBounds(ref: Date): { start: Date; end: Date; key: string } {
  const start = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate()));
  const end = new Date(start.getTime() + 86400000);
  const key = start.toISOString().slice(0, 10);
  return { start, end, key };
}

function fmtDurationPt(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms) || ms <= 0) return '—';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m < 60) return rem ? `${m}min ${rem}s` : `${m}min`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}min`;
}

// ──────────────────────────────────────────────────────────────────
// 1) Agregação diária por org
// ──────────────────────────────────────────────────────────────────
export async function computeOrgDayMetrics(orgId: string, ref: Date): Promise<DayMetrics> {
  const { start, end, key } = dayBounds(ref);

  const [messagesIn, messagesOut, botMessages, newContacts, openConversations, closedConversations, qualifiedLeads] =
    await Promise.all([
      prisma.message.count({ where: { conversation: { organizationId: orgId }, direction: 'INBOUND', createdAt: { gte: start, lt: end } } }),
      prisma.message.count({ where: { conversation: { organizationId: orgId }, direction: 'OUTBOUND', createdAt: { gte: start, lt: end } } }),
      prisma.message.count({ where: { conversation: { organizationId: orgId }, isFromBot: true, createdAt: { gte: start, lt: end } } }),
      prisma.contact.count({ where: { organizationId: orgId, createdAt: { gte: start, lt: end } } }),
      prisma.conversation.count({ where: { organizationId: orgId, status: { in: ['OPEN', 'WAITING', 'ASSIGNED'] } } }),
      prisma.conversation.count({ where: { organizationId: orgId, status: 'CLOSED', closedAt: { gte: start, lt: end } } }),
      prisma.contact.count({ where: { organizationId: orgId, leadStatus: { in: ['QUALIFIED', 'CONVERTED'] }, updatedAt: { gte: start, lt: end } } }),
    ]);

  const csatResult = await prisma.conversation.aggregate({
    where: { organizationId: orgId, csatScore: { not: null }, createdAt: { gte: start, lt: end } },
    _avg: { csatScore: true },
    _count: { csatScore: true },
  });
  const csatAvg = csatResult._avg.csatScore != null ? Math.round(csatResult._avg.csatScore * 10) / 10 : null;
  const csatCount = csatResult._count.csatScore ?? 0;

  const sentimentRows = await prisma.conversation.groupBy({
    by: ['sentiment'],
    where: { organizationId: orgId, sentiment: { not: null }, createdAt: { gte: start, lt: end } },
    _count: true,
  });
  let sentimentPos = 0, sentimentNeu = 0, sentimentNeg = 0;
  for (const row of sentimentRows) {
    const c = typeof row._count === 'number' ? row._count : 0;
    if (row.sentiment === 'POSITIVE') sentimentPos = c;
    else if (row.sentiment === 'NEGATIVE') sentimentNeg = c;
    else sentimentNeu = c;
  }

  const responsePairs = await prisma.$queryRaw<{ avg_ms: number | null }[]>`
    SELECT AVG(EXTRACT(EPOCH FROM (ob.created_at - ib.created_at)) * 1000)::float AS avg_ms
    FROM messages ib
    JOIN messages ob ON ob.conversation_id = ib.conversation_id
      AND ob.direction = 'OUTBOUND'
      AND ob.created_at = (
        SELECT MIN(m2.created_at) FROM messages m2
        WHERE m2.conversation_id = ib.conversation_id
          AND m2.direction = 'OUTBOUND'
          AND m2.created_at > ib.created_at
      )
    JOIN conversations c ON c.id = ib.conversation_id
    WHERE ib.direction = 'INBOUND'
      AND c.organization_id = ${orgId}
      AND ib.created_at >= ${start}
      AND ib.created_at < ${end}
  `;
  const avgFirstResponseMs = responsePairs[0]?.avg_ms != null ? Math.round(responsePairs[0].avg_ms) : null;

  const automationRate = messagesIn > 0 ? Math.round((botMessages / messagesIn) * 100) : 0;

  const metrics: DayMetrics = {
    date: key,
    messagesIn, messagesOut, botMessages, automationRate, newContacts,
    openConversations, closedConversations, avgFirstResponseMs,
    csatAvg, csatCount, sentimentPos, sentimentNeu, sentimentNeg, qualifiedLeads,
  };

  // Upsert idempotente do snapshot (cron pode reprocessar o mesmo dia).
  await prisma.analyticsMetricDaily.upsert({
    where: { organizationId_date: { organizationId: orgId, date: key } },
    create: { organizationId: orgId, ...metrics },
    update: { ...metrics },
  });

  return metrics;
}

// ──────────────────────────────────────────────────────────────────
// 2) Detecção de anomalias (determinística)
// ──────────────────────────────────────────────────────────────────
function stats(values: number[]): { mean: number; std: number } {
  if (values.length === 0) return { mean: 0, std: 0 };
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  return { mean, std: Math.sqrt(variance) };
}

export async function detectAnomalies(orgId: string, today: DayMetrics): Promise<Anomaly[]> {
  const baseline = await prisma.analyticsMetricDaily.findMany({
    where: { organizationId: orgId, date: { lt: today.date } },
    orderBy: { date: 'desc' },
    take: 14,
  });

  const anomalies: Anomaly[] = [];
  const Z = 2;

  function zCheck(
    metric: string,
    label: string,
    todayVal: number | null,
    series: Array<number | null>,
    worseDir: 'up' | 'down',
  ) {
    if (todayVal == null) return;
    const clean = series.filter((v): v is number => v != null);
    if (clean.length < 5) return; // baseline insuficiente
    const { mean, std } = stats(clean);
    if (std <= 0) return;
    const z = (todayVal - mean) / std;
    const direction: 'up' | 'down' = todayVal >= mean ? 'up' : 'down';
    if (Math.abs(z) >= Z && direction === worseDir) {
      anomalies.push({
        metric, label, today: Math.round(todayVal), baseline: Math.round(mean),
        direction, severity: Math.abs(z) >= 3 ? 'critical' : 'attention',
      });
    }
  }

  zCheck('avgFirstResponseMs', 'tempo de 1ª resposta', today.avgFirstResponseMs, baseline.map((b) => b.avgFirstResponseMs), 'up');
  zCheck('automationRate', 'taxa de automação', today.automationRate, baseline.map((b) => b.automationRate), 'down');
  zCheck('csatAvg', 'CSAT', today.csatAvg, baseline.map((b) => b.csatAvg), 'down');
  zCheck('messagesIn', 'volume de mensagens', today.messagesIn, baseline.map((b) => b.messagesIn), 'up');

  // Limiares absolutos (independentes de baseline) — pegam problema já no 1º dia.
  if (today.avgFirstResponseMs != null && today.avgFirstResponseMs > 300000 && !anomalies.some((a) => a.metric === 'avgFirstResponseMs')) {
    anomalies.push({ metric: 'avgFirstResponseMs', label: 'tempo de 1ª resposta', today: today.avgFirstResponseMs, baseline: 300000, direction: 'up', severity: 'attention' });
  }
  if (today.csatAvg != null && today.csatCount >= 3 && today.csatAvg < 3 && !anomalies.some((a) => a.metric === 'csatAvg')) {
    anomalies.push({ metric: 'csatAvg', label: 'CSAT', today: today.csatAvg, baseline: 3, direction: 'down', severity: 'attention' });
  }

  return anomalies;
}

// ──────────────────────────────────────────────────────────────────
// 3/4) Narrativa — fallback determinístico + LLM
// ──────────────────────────────────────────────────────────────────
export function buildDeterministicNarrative(today: DayMetrics, anomalies: Anomaly[]): PulseNarrative {
  const base = `No dia ${today.date}, a IA automatizou ${today.automationRate}% do atendimento (${today.botMessages} de ${today.messagesIn} mensagens), ${today.closedConversations} conversas foram resolvidas e entraram ${today.newContacts} novos contatos. Tempo médio de 1ª resposta: ${fmtDurationPt(today.avgFirstResponseMs)}.`;

  if (anomalies.length === 0) {
    return { title: 'Resumo do dia', narrative: base, severity: 'info', actions: [], source: 'rule' };
  }

  const severity = maxSeverity(anomalies.map((a) => a.severity));
  const top = anomalies.slice().sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity])[0];

  let detail = '';
  const actions: Array<{ label: string; prompt: string }> = [];
  if (top.metric === 'avgFirstResponseMs') {
    detail = ` Atenção: o tempo de 1ª resposta (${fmtDurationPt(top.today)}) ficou bem acima do normal (${fmtDurationPt(top.baseline)}). Pode haver fila acumulada ou fluxo de resposta automática falhando.`;
    actions.push({ label: 'Ver gargalo de resposta', prompt: 'Analise por que o tempo de 1ª resposta subiu hoje e onde está o gargalo no atendimento.' });
  } else if (top.metric === 'automationRate') {
    detail = ` Atenção: a automação caiu para ${top.today}% (normal ~${top.baseline}%). Mais conversas estão indo para atendimento manual.`;
    actions.push({ label: 'Reforçar fluxos', prompt: 'Quais fluxos do Maestro poderiam assumir as conversas que hoje caíram para atendimento manual?' });
  } else if (top.metric === 'csatAvg') {
    detail = ` Atenção: o CSAT caiu para ${top.today} (normal ~${top.baseline}). Vale olhar as conversas mal avaliadas.`;
    actions.push({ label: 'Ver conversas mal avaliadas', prompt: 'Liste as conversas com pior CSAT hoje e o que houve de comum entre elas.' });
  } else if (top.metric === 'messagesIn') {
    detail = ` Hoje o volume de mensagens (${top.today}) ficou bem acima do normal (~${top.baseline}). Garanta que a operação aguenta o pico.`;
    actions.push({ label: 'Ver pico de volume', prompt: 'Mostre o pico de volume de hoje por horário e se a IA deu conta do atendimento.' });
  }

  return {
    title: top.severity === 'critical' ? `Crítico: ${top.label}` : `Atenção: ${top.label}`,
    narrative: base + detail,
    severity,
    actions,
    source: 'rule',
  };
}

const NARRATIVE_SYSTEM = `Você é o "Pulso", um analista de operação dentro de uma plataforma de atendimento e vendas por WhatsApp para pequenas empresas brasileiras.
Recebe FATOS já calculados (números agregados, sem dados pessoais de clientes) e escreve um resumo curto, claro e acionável em português do Brasil para o dono/gestor da empresa.
REGRAS RÍGIDAS:
- Use EXCLUSIVAMENTE os números presentes nos fatos. NUNCA invente, estime ou arredonde de forma diferente.
- 2 a 4 frases. Tom profissional e direto, sem jargão técnico, sem emoji.
- Se houver anomalias, explique a mais relevante e a possível causa em linguagem de negócio.
- Responda APENAS com um objeto JSON válido, sem texto fora dele, no formato:
{"title": "...", "narrative": "...", "severity": "info|attention|critical", "actions": [{"label": "...", "prompt": "..."}]}
- "actions" tem 0 a 2 itens; cada "prompt" é uma pergunta que o gestor faria ao assistente para aprofundar.`;

function safeParseNarrative(text: string): Omit<PulseNarrative, 'source'> | null {
  if (!text) return null;
  let raw = text.trim();
  if (!raw.startsWith('{')) {
    const first = raw.indexOf('{');
    const last = raw.lastIndexOf('}');
    if (first === -1 || last === -1 || last <= first) return null;
    raw = raw.slice(first, last + 1);
  }
  try {
    const obj = JSON.parse(raw);
    if (typeof obj?.title !== 'string' || typeof obj?.narrative !== 'string') return null;
    const severity: PulseSeverity = ['info', 'attention', 'critical'].includes(obj.severity) ? obj.severity : 'info';
    const actions = Array.isArray(obj.actions)
      ? obj.actions
          .filter((a: any) => a && typeof a.label === 'string' && typeof a.prompt === 'string')
          .slice(0, 2)
          .map((a: any) => ({ label: String(a.label).slice(0, 60), prompt: String(a.prompt).slice(0, 240) }))
      : [];
    return { title: String(obj.title).slice(0, 120), narrative: String(obj.narrative).slice(0, 800), severity, actions };
  } catch {
    return null;
  }
}

export async function narrateWithLLM(orgId: string, facts: Record<string, unknown>): Promise<PulseNarrative | null> {
  const userPrompt = `Fatos do período (JSON):\n${JSON.stringify(facts)}\n\nGere o resumo seguindo as regras.`;
  let resp: Awaited<ReturnType<typeof llmRouter.complete>>;
  try {
    resp = await llmRouter.complete({
      system: NARRATIVE_SYSTEM,
      messages: [{ role: 'user', content: userPrompt }],
      maxTokens: 600,
      temperature: 0.3,
      operation: 'classify',
      orgId,
    });
  } catch (err: any) {
    logger.warn('[analyticsPulse] LLM narrate falhou, usando fallback', { orgId, error: String(err?.message ?? err) });
    return null;
  }

  // Auditoria de custo (igual ao eval cron — o router não loga sozinho).
  await logLLMCall({
    organizationId: orgId,
    provider: resp.provider,
    model: resp.model,
    operation: 'classify',
    inputTokens: resp.usage?.inputTokens ?? null,
    outputTokens: resp.usage?.outputTokens ?? null,
    latencyMs: resp.latencyMs,
    fallbackTriggered: resp.attempt > 1,
    attemptCount: resp.attempt,
  });

  const parsed = safeParseNarrative(resp.text);
  if (!parsed) {
    logger.warn('[analyticsPulse] parse da narrativa falhou, usando fallback', { orgId });
    return null;
  }
  return { ...parsed, source: 'llm' };
}

// ──────────────────────────────────────────────────────────────────
// 5) Orquestração — gera e persiste 1 insight por org
// ──────────────────────────────────────────────────────────────────
export async function generatePulseInsight(orgId: string, ref: Date): Promise<{ created: boolean; severity: PulseSeverity }> {
  const today = await computeOrgDayMetrics(orgId, ref);

  // Sem atividade no dia → não gasta LLM nem cria insight.
  if (today.messagesIn === 0 && today.messagesOut === 0 && today.newContacts === 0) {
    return { created: false, severity: 'info' };
  }

  const anomalies = await detectAnomalies(orgId, today);
  const facts = { metrics: today, anomalies };

  const fallback = buildDeterministicNarrative(today, anomalies);
  const llm = await narrateWithLLM(orgId, facts);
  // A severidade é determinística (das anomalias), não do texto da IA.
  const narrative: PulseNarrative = llm ? { ...llm, severity: fallback.severity } : fallback;

  await prisma.analyticsInsight.create({
    data: {
      organizationId: orgId,
      period: today.date,
      kind: anomalies.length > 0 ? 'anomaly' : 'daily_summary',
      severity: narrative.severity,
      title: narrative.title,
      narrative: narrative.narrative,
      facts: facts as any,
      recommendedActions: narrative.actions as any,
      source: narrative.source,
    },
  });

  return { created: true, severity: narrative.severity };
}
