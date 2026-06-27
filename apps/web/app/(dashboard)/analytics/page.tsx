'use client';

import { useEffect, useState } from 'react';
import {
  TrendingUp, TrendingDown, Bot, Users, MessageSquare, Clock, Sparkles,
  Send, CheckCheck, Eye, Reply, CircleDot, Gauge, Smile, RefreshCw, X, ArrowRight,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { api } from '../../../lib/api';

// Guard global: nunca renderiza "undefined"/"null" na tela (V4 fix 2026-05-27).
function fmtNum(v: unknown, opts: { suffix?: string; fallback?: string; decimals?: number } = {}): string {
  const { suffix = '', fallback = '—', decimals } = opts;
  if (v === null || v === undefined || (typeof v === 'number' && Number.isNaN(v))) return fallback;
  if (typeof v === 'number') {
    const formatted = decimals !== undefined
      ? v.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
      : v.toLocaleString('pt-BR');
    return `${formatted}${suffix}`;
  }
  const s = String(v);
  if (s === 'undefined' || s === 'null' || s === 'NaN') return fallback;
  return `${s}${suffix}`;
}

function fmtDuration(ms: unknown): string {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms <= 0) return '—';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m < 60) return rem ? `${m}min ${rem}s` : `${m}min`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}min`;
}

function fmtBRL(v: unknown): string {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : 0;
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

function bucketLabel(bucket: string, gran: string): string {
  if (!bucket) return '?';
  if (gran === 'hour') return `${bucket.slice(11, 13)}h`;
  const p = bucket.slice(0, 10).split('-');
  return `${p[2]}/${p[1]}`;
}

function bucketRange(bucket: string, gran: string): { start: string; end: string } {
  if (gran === 'hour') {
    const start = new Date(`${bucket}:00:00.000Z`);
    return { start: start.toISOString(), end: new Date(start.getTime() + 3600000).toISOString() };
  }
  const start = new Date(`${bucket.slice(0, 10)}T00:00:00.000Z`);
  return { start: start.toISOString(), end: new Date(start.getTime() + 86400000).toISOString() };
}

const SENTI = {
  POSITIVE: { name: 'Positivo', color: '#10B981' },
  NEUTRAL: { name: 'Neutro', color: '#6366F1' },
  NEGATIVE: { name: 'Negativo', color: '#EF4444' },
} as const;

type DrawerState = { open: boolean; loading: boolean; title: string; kind: 'messages' | 'conversations'; items: any[] };

export default function AnalyticsPage() {
  const [overview, setOverview] = useState<any>(null);
  const [sentiment, setSentiment] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [insight, setInsight] = useState<any>(null);
  const [salesAttr, setSalesAttr] = useState<any>(null);
  const [expandedDeal, setExpandedDeal] = useState<string | null>(null);
  const [periodMode, setPeriodMode] = useState<'24h' | '7d' | '30d' | 'custom'>('7d');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshingPulse, setRefreshingPulse] = useState(false);
  const [drawer, setDrawer] = useState<DrawerState>({ open: false, loading: false, title: '', kind: 'messages', items: [] });

  const today = new Date().toISOString().slice(0, 10);
  const rangeQuery = periodMode === 'custom'
    ? (from && to ? `from=${from}&to=${to}` : '')
    : `period=${periodMode}`;

  useEffect(() => {
    // Custom sem as duas datas: aguarda o usuário escolher.
    if (periodMode === 'custom' && (!from || !to)) return;
    const q = rangeQuery;
    setLoading(true);
    Promise.all([
      api.get(`/api/analytics/overview?${q}`).catch(() => null),
      api.get(`/api/analytics/sentiment?${q}`).catch(() => null),
      api.get(`/api/analytics/agents`).catch(() => null),
      api.get(`/api/analytics/campaigns`).catch(() => null),
      api.get(`/api/analytics/insights`).catch(() => null),
      api.get(`/api/analytics/sales-attribution?${q}`).catch(() => null),
    ]).then(([ov, sent, ag, camp, ins, sa]: any[]) => {
      setOverview(ov?.data ?? ov ?? null);
      setSentiment((sent?.data ?? sent ?? []) as any[]);
      setAgents((ag?.data ?? ag ?? []) as any[]);
      setCampaigns((camp?.data ?? camp ?? []) as any[]);
      setInsight(ins?.data ?? null);
      setSalesAttr(sa?.data ?? null);
    }).finally(() => setLoading(false));
  }, [periodMode, from, to]);

  async function handleRefreshPulse() {
    setRefreshingPulse(true);
    try {
      const res = await api.post(`/api/analytics/insights/refresh?today=1`);
      setInsight((res as any)?.data ?? null);
    } catch {
      // silencioso — mantém o fallback determinístico na tela
    } finally {
      setRefreshingPulse(false);
    }
  }

  async function openDrill(params: string, title: string, kind: 'messages' | 'conversations') {
    setDrawer({ open: true, loading: true, title, kind, items: [] });
    try {
      const res = await api.get(`/api/analytics/drilldown?${params}`);
      const items = (res as any)?.data?.items ?? (res as any)?.items ?? [];
      setDrawer((d) => ({ ...d, loading: false, items }));
    } catch {
      setDrawer((d) => ({ ...d, loading: false, items: [] }));
    }
  }

  // ---- Derivações ----
  const automationRate = overview?.automationRate;
  const iaShare = overview?.iaShare;
  const humanShare = overview?.humanShare;
  const botOutbound = overview?.botOutbound;
  const humanOutbound = overview?.humanOutbound;
  const avgMs = overview?.avgResponseTimeMs;
  const p95Ms = overview?.p95ResponseTimeMs;
  const aiResolvedRate = overview?.aiResolvedRate;
  const closed = overview?.closedConversations;
  const open = overview?.openConversations;
  const newContacts = overview?.newContacts;
  const csat = overview?.csat;
  const totalMessages = overview?.totalMessages;
  const granularity = overview?.granularity || 'day';

  // Volume — série temporal real do backend (suporta período custom).
  const volumeData = (Array.isArray(overview?.volumeByDay) ? overview.volumeByDay : []).map((v: any) => ({
    bucket: v.bucket,
    label: bucketLabel(v.bucket, granularity),
    mensagens: v.count,
  }));
  const hasVolume = volumeData.some((d: any) => d.mensagens > 0);

  function onBarClick(d: any) {
    const bucket = d?.payload?.bucket ?? d?.bucket;
    if (!bucket) return;
    const { start, end } = bucketRange(bucket, granularity);
    openDrill(`kind=messages&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
      `Mensagens · ${bucketLabel(bucket, granularity)}`, 'messages');
  }

  // Sentimento
  const sentCounts = sentiment.reduce(
    (acc: any, s: any) => {
      const c = s._count?.sentiment ?? s._count ?? s.count ?? 0;
      if (s.sentiment === 'POSITIVE') acc.pos += c;
      else if (s.sentiment === 'NEGATIVE') acc.neg += c;
      else acc.neu += c;
      return acc;
    },
    { pos: 0, neu: 0, neg: 0 },
  );
  const sentTotal = sentCounts.pos + sentCounts.neu + sentCounts.neg;
  const sentimentData = [
    { key: 'POSITIVE', name: 'Positivo', value: sentCounts.pos, color: '#10B981' },
    { key: 'NEUTRAL', name: 'Neutro', value: sentCounts.neu, color: '#6366F1' },
    { key: 'NEGATIVE', name: 'Negativo', value: sentCounts.neg, color: '#EF4444' },
  ].filter((s) => s.value > 0);

  function onSentimentClick(slice: any) {
    const key = slice?.key ?? slice?.payload?.key;
    const name = slice?.name ?? slice?.payload?.name;
    if (!key || !overview?.rangeStart || !overview?.rangeEnd) return;
    openDrill(`kind=conversations&sentiment=${key}&start=${encodeURIComponent(overview.rangeStart)}&end=${encodeURIComponent(overview.rangeEnd)}`,
      `Conversas · sentimento ${name}`, 'conversations');
  }

  // Funil de campanhas (agregado)
  const camp = campaigns.reduce(
    (a: any, c: any) => ({
      sent: a.sent + (c.sentCount || 0),
      delivered: a.delivered + (c.deliveredCount || 0),
      read: a.read + (c.readCount || 0),
      replied: a.replied + (c.repliedCount || 0),
    }),
    { sent: 0, delivered: 0, read: 0, replied: 0 },
  );
  const funnelSteps = [
    { label: 'Enviadas', value: camp.sent, icon: Send, color: '#85B7EB' },
    { label: 'Entregues', value: camp.delivered, icon: CheckCheck, color: '#378ADD' },
    { label: 'Lidas', value: camp.read, icon: Eye, color: '#1B6B3A' },
    { label: 'Respondidas', value: camp.replied, icon: Reply, color: '#10B981' },
  ];
  const hasCampaigns = camp.sent > 0;

  // ---- Resumo determinístico (fallback do Pulso, sem LLM) ----
  function buildResumo(): { tone: 'ok' | 'warn'; main: string; note?: string } {
    if (!overview) return { tone: 'ok', main: 'Sem dados suficientes no período selecionado.' };
    const main = `No período, a IA automatizou ${fmtNum(automationRate, { suffix: '%' })} do atendimento e ${fmtNum(closed)} conversas foram resolvidas. Tempo médio de 1ª resposta: ${fmtDuration(avgMs)}.`;
    let note: string | undefined;
    let tone: 'ok' | 'warn' = 'ok';
    if (typeof avgMs === 'number' && avgMs > 300000) {
      tone = 'warn';
      note = `Atenção: o tempo médio de 1ª resposta está em ${fmtDuration(avgMs)} — acima de 5 min.`;
    } else if (typeof automationRate === 'number' && automationRate < 40) {
      tone = 'warn';
      note = `A automação está em ${fmtNum(automationRate, { suffix: '%' })}: boa parte do atendimento ainda é manual.`;
    } else if (typeof automationRate === 'number' && automationRate >= 70) {
      note = `Bom ritmo: a IA já segura a maior parte do atendimento sozinha.`;
    }
    return { tone, main, note };
  }
  const resumo = buildResumo();

  // ---- Deltas (vs. período anterior) ----
  const prev = overview?.prev;
  type Delta = { text: string; dir: 'up' | 'down' | 'flat' } | null;
  const deltaPP = (cur: any, prv: any): Delta => {
    if (typeof cur !== 'number' || typeof prv !== 'number') return null;
    const d = cur - prv;
    return d === 0 ? { text: 'estável', dir: 'flat' } : { text: `${d > 0 ? '+' : ''}${d}pp`, dir: d > 0 ? 'up' : 'down' };
  };
  const deltaPct = (cur: any, prv: any): Delta => {
    if (typeof cur !== 'number' || typeof prv !== 'number' || prv === 0) return null;
    const d = Math.round(((cur - prv) / Math.abs(prv)) * 100);
    return d === 0 ? { text: 'estável', dir: 'flat' } : { text: `${d > 0 ? '+' : ''}${d}%`, dir: d > 0 ? 'up' : 'down' };
  };
  const deltaAbs = (cur: any, prv: any): Delta => {
    if (typeof cur !== 'number' || typeof prv !== 'number') return null;
    const d = Math.round((cur - prv) * 10) / 10;
    return d === 0 ? { text: 'estável', dir: 'flat' } : { text: `${d > 0 ? '+' : ''}${d.toLocaleString('pt-BR')}`, dir: d > 0 ? 'up' : 'down' };
  };

  const resultCards = [
    { label: 'Respostas pela IA', value: fmtNum(iaShare, { suffix: '%' }), icon: Bot, hint: `${fmtNum(botOutbound)} IA · ${fmtNum(humanOutbound)} humano`, delta: prev ? deltaPP(iaShare, prev.iaShare) : null },
    { label: 'Conversas resolvidas', value: fmtNum(closed), icon: CheckCheck, hint: typeof aiResolvedRate === 'number' ? `${aiResolvedRate}% sem precisar de humano` : 'fechadas no período', delta: prev ? deltaPct(closed, prev.closedConversations) : null },
    { label: 'Novos contatos', value: fmtNum(newContacts), icon: Users, hint: 'entraram no período', delta: prev ? deltaPct(newContacts, prev.newContacts) : null },
    { label: 'CSAT', value: fmtNum(csat, { decimals: 1 }), icon: Smile, hint: 'satisfação média (0–5)', delta: prev ? deltaAbs(csat, prev.csat) : null },
  ];

  return (
    <div className="pb-10">
      {/* Cabeçalho + seletor de período */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-sm text-gray-500 mt-1">Visão geral da sua operação</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={periodMode}
            onChange={(e) => setPeriodMode(e.target.value as any)}
            className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm"
          >
            <option value="24h">Últimas 24 horas</option>
            <option value="7d">Últimos 7 dias</option>
            <option value="30d">Últimos 30 dias</option>
            <option value="custom">Escolher período…</option>
          </select>
          {periodMode === 'custom' && (
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-1.5">
              <input type="date" value={from} max={to || today} onChange={(e) => setFrom(e.target.value)}
                className="text-sm text-gray-700 outline-none" />
              <ArrowRight size={14} className="text-gray-400" />
              <input type="date" value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)}
                className="text-sm text-gray-700 outline-none" />
            </div>
          )}
        </div>
      </div>

      {periodMode === 'custom' && (!from || !to) && (
        <div className="mb-6 text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-lg p-3">
          Selecione a data de início e fim para carregar a análise do período.
        </div>
      )}

      {/* Pulso — insight narrado pela IA (com fallback determinístico) */}
      {(() => {
        const sev: string = insight?.severity || (resumo.tone === 'warn' ? 'attention' : 'info');
        const tone =
          sev === 'critical'
            ? { box: 'bg-red-50 border-red-200', icon: 'text-red-600', title: 'text-red-800' }
            : sev === 'attention'
            ? { box: 'bg-amber-50 border-amber-200', icon: 'text-amber-600', title: 'text-amber-800' }
            : { box: 'bg-emerald-50 border-emerald-200', icon: 'text-emerald-700', title: 'text-emerald-800' };
        const actions: Array<{ label: string; prompt: string }> = Array.isArray(insight?.recommendedActions)
          ? insight.recommendedActions
          : [];
        return (
          <div className={`rounded-xl border p-5 mb-8 ${tone.box}`}>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={16} className={tone.icon} />
              <span className={`text-sm font-semibold ${tone.title}`}>
                {insight?.title || 'Resumo da operação'}
              </span>
              <span className="ml-2 text-[11px] px-2 py-0.5 rounded-full bg-white/70 text-gray-500 border border-gray-200">
                {insight ? (insight.source === 'llm' ? 'Pulso · IA' : 'Pulso · automático') : 'Pulso'}
              </span>
              <button
                onClick={handleRefreshPulse}
                disabled={refreshingPulse}
                className="ml-auto flex items-center gap-1 text-[12px] text-gray-500 hover:text-gray-700 disabled:opacity-50"
                title="Gerar análise do dia com a IA"
              >
                <RefreshCw size={13} className={refreshingPulse ? 'animate-spin' : ''} />
                {refreshingPulse ? 'Analisando…' : insight ? 'Atualizar' : 'Gerar com IA'}
              </button>
            </div>
            {loading ? (
              <div className="h-4 bg-white/60 rounded w-2/3 animate-pulse" />
            ) : insight ? (
              <>
                <p className="text-[15px] leading-relaxed text-gray-800">{insight.narrative}</p>
                {actions.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {actions.map((a, i) => (
                      <span key={i} className="text-[12px] px-2.5 py-1 rounded-full bg-white/80 text-gray-700 border border-gray-200">
                        {a.label}
                      </span>
                    ))}
                  </div>
                )}
                {insight.createdAt && (
                  <p className="text-[11px] text-gray-400 mt-3">
                    análise de {String(insight.period || '').split('-').reverse().join('/')} · gerada {new Date(insight.createdAt).toLocaleString('pt-BR')}
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="text-[15px] leading-relaxed text-gray-800">{resumo.main}</p>
                {resumo.note && <p className="text-sm text-gray-600 mt-2">{resumo.note}</p>}
              </>
            )}
          </div>
        );
      })()}

      {/* Camada 1 — Resultado */}
      <SectionTitle icon={TrendingUp} title="Resultado" hint="o que a operação entregou" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {loading
          ? [...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl p-5 border border-gray-100 animate-pulse">
                <div className="h-8 bg-gray-200 rounded w-16" />
              </div>
            ))
          : resultCards.map((kpi) => (
              <div key={kpi.label} className="bg-white rounded-xl p-5 border border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-500 uppercase font-medium">{kpi.label}</span>
                  <kpi.icon size={16} className="text-[#1B6B3A]" />
                </div>
                <p className="text-2xl font-bold text-gray-900">{kpi.value}</p>
                {kpi.delta && (
                  <p className={`text-xs mt-1 flex items-center gap-1 ${
                    kpi.delta.dir === 'up' ? 'text-emerald-600' : kpi.delta.dir === 'down' ? 'text-red-500' : 'text-gray-400'
                  }`}>
                    {kpi.delta.dir === 'up' && <TrendingUp size={12} />}
                    {kpi.delta.dir === 'down' && <TrendingDown size={12} />}
                    {kpi.delta.text} vs. período anterior
                  </p>
                )}
                <p className="text-xs text-gray-400 mt-1">{kpi.hint}</p>
              </div>
            ))}
      </div>

      {/* Vendas atribuídas à IA */}
      <SectionTitle icon={Bot} title="Vendas atribuídas à IA" hint="quanto a IA fechou e assistiu" />
      <div className="mb-8">
        {salesAttr && salesAttr.dealsWon > 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <div className="flex flex-wrap items-end gap-6 mb-5">
              <div>
                <div className="text-xs text-gray-500 mb-1">Receita atribuída à IA</div>
                <div className="text-3xl font-bold text-gray-900">{fmtBRL(salesAttr.attributedTotal)}</div>
                <div className="text-xs text-gray-400 mt-1">{salesAttr.attributedPct}% da receita ganha no período</div>
              </div>
              <div className="flex gap-3">
                <div className="bg-emerald-50 rounded-lg px-4 py-3">
                  <div className="flex items-center gap-1.5 text-emerald-700 text-xs font-medium mb-1"><Bot size={13} /> Fechada pela IA</div>
                  <div className="text-lg font-bold text-gray-900">{fmtBRL(salesAttr.aiClosedValue)}</div>
                </div>
                <div className="bg-blue-50 rounded-lg px-4 py-3">
                  <div className="flex items-center gap-1.5 text-blue-700 text-xs font-medium mb-1"><Users size={13} /> Assistida pela IA</div>
                  <div className="text-lg font-bold text-gray-900">{fmtBRL(salesAttr.aiAssistedValue)}</div>
                </div>
              </div>
            </div>
            <div className="divide-y divide-gray-100 border-t border-gray-100">
              {salesAttr.deals.map((d: any) => {
                const open = expandedDeal === d.id;
                const moments = Array.isArray(d.moments) ? d.moments : [];
                return (
                  <div key={d.id}>
                    <button
                      onClick={() => setExpandedDeal(open ? null : d.id)}
                      className="w-full flex items-center justify-between py-2.5 gap-3 text-left hover:bg-gray-50 -mx-2 px-2 rounded"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Sparkles size={13} className="text-amber-500 shrink-0" />
                        <span className="text-sm text-gray-800 truncate">{d.contactName || 'Contato'}{d.title ? ` · ${d.title}` : ''}</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className={`text-[11px] px-2 py-0.5 rounded-full ${d.bucket === 'ai_closed' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                          {d.bucket === 'ai_closed' ? 'Fechada pela Iza' : 'Assistida'}
                        </span>
                        <span className="text-sm font-medium text-gray-900">{fmtBRL(d.value)}</span>
                      </div>
                    </button>
                    {open && (
                      <div className="pb-3 pl-5">
                        <div className="text-[11px] text-gray-400 mb-2">Momentos que a Iza destravou</div>
                        {moments.length > 0 ? moments.map((m: any, i: number) => (
                          <div key={i} className="border-l-2 border-emerald-300 pl-3 mb-2">
                            <p className="text-[13px] text-gray-800 break-words">{m.content}</p>
                            <p className="text-[11px] text-gray-400">
                              {new Date(m.createdAt).toLocaleString('pt-BR')}
                              {typeof m.aiConfidence === 'number' ? ` · confiança ${m.aiConfidence.toFixed(2)}` : ''}
                            </p>
                          </div>
                        )) : <p className="text-[12px] text-gray-400">Sem mensagens da IA registradas nessa janela.</p>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-[11px] text-gray-400 mt-3">
              Clique num deal para ver os momentos que a Iza destravou. Regra: última conversa da IA dentro de 7 dias do ganho (sem humano nas 24h finais = fechada pela IA). Tendência, não prova causal.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 p-6 text-sm text-gray-400 text-center">
            Quando você marcar vendas como ganhas no CRM, mostramos aqui quanto a IA fechou e assistiu — separando o que ela fechou sozinha do que ela ajudou a fechar.
          </div>
        )}
      </div>

      {/* Camada 2 — Operação */}
      <SectionTitle icon={Gauge} title="Operação" hint="como está o atendimento" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-4">
        {/* Volume (clicável) */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">Volume de mensagens recebidas</h3>
            <span className="text-[11px] text-gray-400">clique numa barra para ver as mensagens</span>
          </div>
          {hasVolume ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={volumeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip formatter={(v: any) => [v, 'mensagens']} />
                <Bar dataKey="mensagens" fill="#1B6B3A" radius={[6, 6, 0, 0]} cursor="pointer" onClick={onBarClick} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[260px] text-sm text-gray-400">
              Sem mensagens recebidas no período
            </div>
          )}
        </div>

        {/* Indicadores operacionais */}
        <div className="flex flex-col gap-4">
          <MiniStat icon={Clock} label="1ª resposta (média)" value={fmtDuration(avgMs)}
            hint={typeof p95Ms === 'number' && p95Ms > 0 ? `p95: ${fmtDuration(p95Ms)}` : 'mediana do período'} />
          <MiniStat icon={MessageSquare} label="Conversas abertas" value={fmtNum(open)} hint="aguardando ou em andamento" />
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex items-center gap-2 mb-2">
              <Bot size={15} className="text-gray-400" />
              <span className="text-xs text-gray-500">Respostas: IA vs humano</span>
            </div>
            {(botOutbound ?? 0) + (humanOutbound ?? 0) > 0 ? (
              <>
                <div className="flex gap-1 h-2.5 rounded-full overflow-hidden bg-gray-100">
                  <div style={{ width: `${iaShare ?? 0}%`, background: '#1B6B3A' }} />
                  <div style={{ width: `${humanShare ?? 0}%`, background: '#378ADD' }} />
                </div>
                <div className="flex justify-between text-[11px] mt-1.5">
                  <span className="text-[#1B6B3A]">{fmtNum(botOutbound)} IA ({fmtNum(iaShare, { suffix: '%' })})</span>
                  <span className="text-[#185FA5]">{fmtNum(humanOutbound)} humano ({fmtNum(humanShare, { suffix: '%' })})</span>
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-400 mt-1">Sem respostas enviadas no período</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Sentimento (clicável) */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">Sentimento das conversas</h3>
            <span className="text-[11px] text-gray-400">clique numa fatia</span>
          </div>
          {sentimentData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={sentimentData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value"
                    cursor="pointer" onClick={onSentimentClick}
                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                    {sentimentData.map((s, i) => <Cell key={i} fill={s.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <p className="text-xs text-gray-400 text-center mt-1">{fmtNum(sentTotal)} conversas avaliadas</p>
            </>
          ) : (
            <div className="flex items-center justify-center h-[200px] text-sm text-gray-400">Sem dados de sentimento</div>
          )}
        </div>

        {/* Equipe / carga */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Equipe &amp; carga de atendimento</h3>
          {agents.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {agents.slice(0, 6).map((a: any) => (
                <div key={a.id} className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-2">
                    <CircleDot size={12} className={a.isOnline ? 'text-emerald-500' : 'text-gray-300'} />
                    <span className="text-sm text-gray-800">{a.name || 'Sem nome'}</span>
                    <span className="text-[11px] text-gray-400 uppercase">{a.role}</span>
                  </div>
                  <div className="flex items-center gap-5 text-xs text-gray-500">
                    <span>{fmtNum(a._count?.assignedConversations)} conversas</span>
                    <span>{fmtNum(a._count?.messages)} msgs</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-[160px] text-sm text-gray-400">Nenhum atendente cadastrado</div>
          )}
        </div>
      </div>

      {/* Camada 3 — Funil de campanhas */}
      <SectionTitle icon={Send} title="Campanhas" hint="alcance das mensagens enviadas em massa" />
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        {hasCampaigns ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {funnelSteps.map((step, i) => {
              const pct = camp.sent > 0 ? Math.round((step.value / camp.sent) * 100) : 0;
              return (
                <div key={step.label}>
                  <div className="flex items-center gap-2 mb-2">
                    <step.icon size={15} style={{ color: step.color }} />
                    <span className="text-xs text-gray-500">{step.label}</span>
                  </div>
                  <p className="text-xl font-bold text-gray-900">{fmtNum(step.value)}</p>
                  <div className="mt-2 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: step.color }} />
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1">{i === 0 ? 'base' : `${pct}% das enviadas`}</p>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center justify-center h-[120px] text-sm text-gray-400">
            Nenhuma campanha enviada no período
          </div>
        )}
      </div>

      {drawer.open && <DrillDrawer drawer={drawer} onClose={() => setDrawer((d) => ({ ...d, open: false }))} />}
    </div>
  );
}

function SectionTitle({ icon: Icon, title, hint }: { icon: any; title: string; hint: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon size={18} className="text-gray-400" />
      <span className="text-base font-semibold text-gray-900">{title}</span>
      <span className="text-sm text-gray-400">{hint}</span>
    </div>
  );
}

function MiniStat({ icon: Icon, label, value, hint }: { icon: any; label: string; value: string; hint?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <div className="flex items-center gap-2 mb-1.5">
        <Icon size={15} className="text-gray-400" />
        <span className="text-xs text-gray-500">{label}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {hint && <p className="text-[11px] text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

function DrillDrawer({ drawer, onClose }: { drawer: DrawerState; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-md h-full bg-white shadow-xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <p className="text-sm font-semibold text-gray-900">{drawer.title}</p>
            <p className="text-[11px] text-gray-400">{drawer.loading ? 'carregando…' : `${drawer.items.length} ${drawer.kind === 'messages' ? 'mensagens' : 'conversas'}`}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {drawer.loading ? (
            <div className="space-y-3 mt-2">
              {[...Array(6)].map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />)}
            </div>
          ) : drawer.items.length === 0 ? (
            <div className="text-sm text-gray-400 text-center mt-10">Nada encontrado nesse recorte.</div>
          ) : drawer.kind === 'messages' ? (
            <div className="space-y-2">
              {drawer.items.map((m: any) => (
                <div key={m.id} className={`rounded-lg p-3 text-sm ${m.direction === 'INBOUND' ? 'bg-gray-50' : 'bg-emerald-50'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12px] font-medium text-gray-700">
                      {m.conversation?.contact?.name || m.conversation?.contact?.phone || 'Contato'}
                    </span>
                    <span className="text-[11px] text-gray-400">
                      {m.direction === 'INBOUND' ? 'recebida' : m.isFromBot ? 'IA' : 'equipe'} · {new Date(m.createdAt).toLocaleString('pt-BR')}
                    </span>
                  </div>
                  <p className="text-gray-800 break-words">{m.content || `[${(m.type || 'mídia').toLowerCase()}]`}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {drawer.items.map((c: any) => {
                const senti = (SENTI as any)[c.sentiment];
                return (
                  <div key={c.id} className="rounded-lg border border-gray-100 p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[13px] font-medium text-gray-800">{c.contact?.name || c.contact?.phone || 'Contato'}</span>
                      <span className="text-[11px] text-gray-400">{new Date(c.createdAt).toLocaleDateString('pt-BR')}</span>
                    </div>
                    <p className="text-[13px] text-gray-600 break-words line-clamp-2">{c.messages?.[0]?.content || 'sem mensagens'}</p>
                    <div className="flex items-center gap-2 mt-2">
                      {senti && <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: `${senti.color}22`, color: senti.color }}>{senti.name}</span>}
                      <span className="text-[11px] text-gray-400">{c._count?.messages ?? 0} mensagens · {String(c.status || '').toLowerCase()}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
