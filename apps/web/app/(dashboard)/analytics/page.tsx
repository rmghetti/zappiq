'use client';

import { useEffect, useState } from 'react';
import {
  TrendingUp, Bot, Users, MessageSquare, Clock, Sparkles,
  Send, CheckCheck, Eye, Reply, CircleDot, Gauge, Smile, RefreshCw,
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

const WEEK_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WEEK_PT: Record<string, string> = { Mon: 'Seg', Tue: 'Ter', Wed: 'Qua', Thu: 'Qui', Fri: 'Sex', Sat: 'Sáb', Sun: 'Dom' };

export default function AnalyticsPage() {
  const [overview, setOverview] = useState<any>(null);
  const [sentiment, setSentiment] = useState<any[]>([]);
  const [heatmap, setHeatmap] = useState<Record<string, Record<string, number>>>({});
  const [agents, setAgents] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [insight, setInsight] = useState<any>(null);
  const [period, setPeriod] = useState('7d');
  const [loading, setLoading] = useState(true);
  const [refreshingPulse, setRefreshingPulse] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get(`/api/analytics/overview?period=${period}`).catch(() => null),
      api.get(`/api/analytics/sentiment?period=${period}`).catch(() => null),
      api.get(`/api/analytics/heatmap?period=${period}`).catch(() => null),
      api.get(`/api/analytics/agents`).catch(() => null),
      api.get(`/api/analytics/campaigns`).catch(() => null),
      api.get(`/api/analytics/insights`).catch(() => null),
    ]).then(([ov, sent, heat, ag, camp, ins]: any[]) => {
      setOverview(ov?.data ?? ov ?? null);
      setSentiment((sent?.data ?? sent ?? []) as any[]);
      setHeatmap((heat?.data ?? heat ?? {}) as Record<string, Record<string, number>>);
      setAgents((ag?.data ?? ag ?? []) as any[]);
      setCampaigns((camp?.data ?? camp ?? []) as any[]);
      setInsight(ins?.data ?? null);
    }).finally(() => setLoading(false));
  }, [period]);

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

  // ---- Derivações ----
  const automationRate = overview?.automationRate;
  const avgMs = overview?.avgResponseTimeMs;
  const p95Ms = overview?.p95ResponseTimeMs;
  const aiResolvedRate = overview?.aiResolvedRate;
  const closed = overview?.closedConversations;
  const open = overview?.openConversations;
  const newContacts = overview?.newContacts;
  const csat = overview?.csat;
  const totalMessages = overview?.totalMessages;

  // Volume por dia derivado do heatmap (mensagens recebidas)
  const volumeData = WEEK_ORDER.map((d) => {
    const hours = heatmap?.[d] || {};
    const total = Object.values(hours).reduce((a, b) => a + (Number(b) || 0), 0);
    return { day: WEEK_PT[d], mensagens: total };
  });
  const hasVolume = volumeData.some((d) => d.mensagens > 0);

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
    { name: 'Positivo', value: sentCounts.pos, color: '#10B981' },
    { name: 'Neutro', value: sentCounts.neu, color: '#6366F1' },
    { name: 'Negativo', value: sentCounts.neg, color: '#EF4444' },
  ].filter((s) => s.value > 0);

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

  // ---- Resumo (semente determinística do "Pulso", sem LLM) ----
  function buildResumo(): { tone: 'ok' | 'warn'; main: string; note?: string } {
    if (!overview) return { tone: 'ok', main: 'Sem dados suficientes no período selecionado.' };
    const main = `No período, a IA automatizou ${fmtNum(automationRate, { suffix: '%' })} do atendimento e ${fmtNum(closed)} conversas foram resolvidas. Tempo médio de 1ª resposta: ${fmtDuration(avgMs)}.`;
    let note: string | undefined;
    let tone: 'ok' | 'warn' = 'ok';
    if (typeof avgMs === 'number' && avgMs > 300000) {
      tone = 'warn';
      note = `Atenção: o tempo médio de 1ª resposta está em ${fmtDuration(avgMs)} — acima de 5 min. Vale revisar a fila ou reforçar a resposta automática nos fluxos.`;
    } else if (typeof automationRate === 'number' && automationRate < 40) {
      tone = 'warn';
      note = `A automação está em ${fmtNum(automationRate, { suffix: '%' })}: boa parte do atendimento ainda é manual. Há espaço para os fluxos do Maestro assumirem mais conversas.`;
    } else if (typeof automationRate === 'number' && automationRate >= 70) {
      note = `Bom ritmo: a IA já segura a maior parte do atendimento sozinha.`;
    }
    return { tone, main, note };
  }
  const resumo = buildResumo();

  const resultCards = [
    { label: 'Atendido pela IA', value: fmtNum(automationRate, { suffix: '%' }), icon: Bot, hint: 'das mensagens' },
    { label: 'Conversas resolvidas', value: fmtNum(closed), icon: CheckCheck, hint: typeof aiResolvedRate === 'number' ? `${aiResolvedRate}% sem precisar de humano` : 'fechadas no período' },
    { label: 'Novos contatos', value: fmtNum(newContacts), icon: Users, hint: 'entraram no período' },
    { label: 'CSAT', value: fmtNum(csat, { decimals: 1 }), icon: Smile, hint: 'satisfação média (0–5)' },
  ];

  return (
    <div className="pb-10">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-sm text-gray-500 mt-1">Visão geral da sua operação</p>
        </div>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm"
        >
          <option value="24h">24 horas</option>
          <option value="7d">7 dias</option>
          <option value="30d">30 dias</option>
        </select>
      </div>

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
                <p className="text-xs text-gray-400 mt-1">{kpi.hint}</p>
              </div>
            ))}
      </div>

      {/* Camada 2 — Operação */}
      <SectionTitle icon={Gauge} title="Operação" hint="como está o atendimento" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-4">
        {/* Volume */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Volume de mensagens recebidas</h3>
          {hasVolume ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={volumeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="mensagens" fill="#1B6B3A" radius={[6, 6, 0, 0]} />
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
          <MiniStat icon={Clock} label="1ª resposta (média)" value={fmtDuration(avgMs)} hint={typeof p95Ms === 'number' && p95Ms > 0 ? `p95: ${fmtDuration(p95Ms)}` : 'mediana do período'} />
          <MiniStat icon={MessageSquare} label="Conversas abertas" value={fmtNum(open)} hint="aguardando ou em andamento" />
          <MiniStat icon={MessageSquare} label="Mensagens totais" value={fmtNum(totalMessages)} hint="recebidas no período" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Sentimento */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Sentimento das conversas</h3>
          {sentimentData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={sentimentData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value"
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
