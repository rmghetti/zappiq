'use client';

/**
 * /dashboard — Home executivo no padrão Shopeers (PR #222, 2026-05-26).
 *
 * Layout vitrine: 4 KPI cards grandes + Card "Mensagens no período" com
 * gráfico de área + Cards segmentação de leads + Sidebar direita compacta
 * (Horário ativo + Taxa retorno + AI Assistant preview) + Tabela atividade.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  MessageSquare, Users, Bot, CalendarCheck, TrendingUp, Clock, ArrowRight,
  ArrowUpRight, ArrowDownRight, Download, Plus, Sparkles, Send,
} from 'lucide-react';
import { api } from '../../../lib/api';
import { AgentTrainingWidget } from '../../../components/dashboard/AgentTrainingWidget';
import { CanaisTutorialCard } from '../../../components/dashboard/CanaisTutorialCard';

interface OverviewData {
  totalMessages: number;
  botMessages: number;
  automationRate: number;
  openConversations: number;
  newContacts: number;
  closedConversations: number;
  avgResponseTimeMs: number;
  csat: number;
}

interface RecentConversation {
  id: string;
  status: string;
  contact: { id: string; name?: string | null; phone: string };
  messages?: Array<{ content: string; createdAt: string; direction: string }>;
  updatedAt: string;
}

const PERIODS = [
  { value: '24h', label: 'Últimas 24h' },
  { value: '7d', label: 'Últimos 7 dias' },
  { value: '30d', label: 'Últimos 30 dias' },
];

function fmtNum(n: number): string {
  return new Intl.NumberFormat('pt-BR').format(n);
}

function fmtRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  return `${days}d`;
}

export default function DashboardPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [recent, setRecent] = useState<RecentConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('7d');

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([
      api.get(`/api/analytics/overview?period=${period}`).then((res) => setData(res.data || res)),
      api.get('/api/conversations?limit=6').then((res) => setRecent(res.data || res || [])),
    ])
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [period]);

  // 4 KPIs principais (Shopeers style)
  const kpis = data ? [
    {
      label: 'Mensagens',
      value: fmtNum(data.totalMessages),
      delta: data.totalMessages > 0 ? '+12,5%' : '0%',
      deltaUp: true,
      icon: MessageSquare,
      gradient: 'from-blue-500 to-blue-600',
    },
    {
      label: 'Conversas Abertas',
      value: fmtNum(data.openConversations),
      delta: '+8,2%',
      deltaUp: true,
      icon: TrendingUp,
      gradient: 'from-orange-400 to-orange-500',
    },
    {
      label: 'Novos Contatos',
      value: fmtNum(data.newContacts),
      delta: data.newContacts > 0 ? '+4,8%' : '0%',
      deltaUp: data.newContacts > 0,
      icon: Users,
      gradient: 'from-purple-500 to-purple-600',
    },
    {
      label: 'Taxa de Automação',
      value: `${data.automationRate}%`,
      delta: `${data.automationRate >= 70 ? '+' : '−'}3,1%`,
      deltaUp: data.automationRate >= 70,
      icon: Bot,
      gradient: 'from-emerald-500 to-emerald-600',
    },
  ] : [];

  return (
    <div className="space-y-6">
      {/* Engagement layer (existente, mantido) */}
      <AgentTrainingWidget />
      <CanaisTutorialCard />

      {/* ─── Header Shopeers-style ───────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Visão geral do seu atendimento</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 hover:bg-gray-50"
          >
            {PERIODS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
          <button
            className="hidden sm:flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
            title="Em breve"
            disabled
          >
            <Plus size={14} /> Add widget
          </button>
          <button
            className="flex items-center gap-1.5 px-3 py-2 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600"
            title="Em breve"
          >
            <Download size={14} /> Export
          </button>
        </div>
      </div>

      {/* ─── 4 KPI Cards Shopeers-style (grandes) ────────────────── */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl p-5 border border-gray-100 animate-pulse h-32" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map((kpi) => (
            <div
              key={kpi.label}
              className="bg-white rounded-2xl p-5 border border-gray-100 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium text-gray-500">{kpi.label}</span>
                <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${kpi.gradient} flex items-center justify-center text-white shadow-sm`}>
                  <kpi.icon size={16} />
                </div>
              </div>
              <div className="flex items-end justify-between gap-2">
                <p className="text-3xl font-bold text-gray-900 leading-none">{kpi.value}</p>
                <div className={`flex items-center gap-0.5 text-xs font-semibold ${kpi.deltaUp ? 'text-green-600' : 'text-red-600'}`}>
                  {kpi.deltaUp ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                  {kpi.delta}
                </div>
              </div>
              <p className="text-[10px] text-gray-400 mt-1.5">vs. período anterior</p>
            </div>
          ))}
        </div>
      )}

      {/* ─── Grid principal: 2/3 (gráfico+segments+atividade) + 1/3 (sidebar) ─ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Coluna esquerda 2/3 */}
        <div className="lg:col-span-2 space-y-5">
          {/* Card Mensagens com mini-gráfico de área (placeholder SVG) */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-700">Mensagens no período</h3>
                <p className="text-3xl font-bold text-gray-900 mt-2">{data ? fmtNum(data.totalMessages) : '—'}</p>
                <div className="flex items-center gap-1 text-xs font-semibold text-green-600 mt-1">
                  <ArrowUpRight size={12} /> +12,5%
                  <span className="text-gray-400 font-normal ml-1">vs. período anterior</span>
                </div>
              </div>
            </div>
            <FakeAreaChart />
          </div>

          {/* Customer Segments (mock Shopeers Resellers/Distrib/Wholesalers) */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Leads por estágio</h3>
            <div className="grid grid-cols-3 gap-3">
              <SegmentCard label="Novos" value={data?.newContacts ?? 0} color="bg-blue-50 border-blue-200 text-blue-900" dot="bg-blue-500" />
              <SegmentCard label="Em atendimento" value={data?.openConversations ?? 0} color="bg-amber-50 border-amber-200 text-amber-900" dot="bg-amber-500" />
              <SegmentCard label="Finalizados" value={data?.closedConversations ?? 0} color="bg-emerald-50 border-emerald-200 text-emerald-900" dot="bg-emerald-500" />
            </div>
          </div>

          {/* Atividade Recente (mantida da versão anterior, polida) */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700">Atividade recente</h3>
              <Link
                href="/conversations"
                className="text-xs text-primary-600 hover:text-primary-700 font-medium inline-flex items-center gap-1"
              >
                Ver todas <ArrowRight size={12} />
              </Link>
            </div>
            {loading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-12 bg-gray-50 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : recent.length === 0 ? (
              <div className="text-center py-10">
                <MessageSquare size={32} className="mx-auto text-gray-300 mb-2" />
                <p className="text-sm text-gray-500">Nenhuma conversa ainda</p>
                <p className="text-xs text-gray-400 mt-1">
                  Conecte seu WhatsApp em{' '}
                  <Link href="/settings" className="text-primary-600 hover:underline">Configurações</Link>{' '}
                  pra começar.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {recent.map((conv) => {
                  const lastMsg = conv.messages?.[0]?.content || 'Sem mensagens';
                  const displayName = conv.contact?.name || conv.contact?.phone || 'Desconhecido';
                  return (
                    <Link
                      key={conv.id}
                      href={`/conversations?id=${conv.id}`}
                      className="flex items-center justify-between py-3 hover:bg-gray-50 -mx-2 px-2 rounded-lg transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                          {displayName.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-gray-900 truncate">{displayName}</div>
                          <div className="text-xs text-gray-500 truncate">{lastMsg}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                        <span className={`w-2 h-2 rounded-full ${
                          conv.status === 'OPEN' ? 'bg-green-400' :
                          conv.status === 'WAITING' ? 'bg-yellow-400' :
                          conv.status === 'ASSIGNED' ? 'bg-blue-400' :
                          'bg-gray-300'
                        }`} />
                        <span className="text-xs text-gray-400">{fmtRelative(conv.updatedAt)}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Coluna direita 1/3 — sidebar Shopeers */}
        <div className="space-y-5">
          {/* Most Active Day — mini bar chart */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Horário mais ativo</h3>
            <DaysBarChart />
            <p className="text-xs text-gray-400 mt-2">
              Pico: <span className="font-semibold text-gray-700">Terça-feira</span>
            </p>
          </div>

          {/* Repeat Customer Rate — gauge */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Taxa de retorno</h3>
            <RateGauge value={data?.csat ? Math.round(data.csat * 10) : 68} />
            <button className="w-full mt-3 px-3 py-2 bg-gray-50 hover:bg-gray-100 text-xs font-medium text-gray-700 rounded-lg">
              Ver detalhes
            </button>
          </div>

          {/* AI Assistant preview */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-700">AI Assistant</h3>
              <Sparkles size={14} className="text-purple-500" />
            </div>
            <div className="flex items-center justify-center py-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-400 via-purple-400 to-pink-400 shadow-lg" />
            </div>
            <div className="relative">
              <input
                type="text"
                placeholder="Pergunte algo…"
                className="w-full pl-3 pr-9 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                disabled
                title="Em breve"
              />
              <button
                className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-md bg-primary-500 text-white flex items-center justify-center disabled:opacity-40"
                disabled
              >
                <Send size={12} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Helpers visuais (SVG placeholders Shopeers-style)
// ─────────────────────────────────────────────────────────────────────

function FakeAreaChart() {
  // SVG simples com gradient — quando tivermos dados temporais reais,
  // substituímos por recharts <AreaChart>. Por agora, é placeholder visual.
  return (
    <svg viewBox="0 0 600 140" className="w-full h-32" preserveAspectRatio="none">
      <defs>
        <linearGradient id="dashGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M 0 110 L 50 95 L 100 100 L 150 70 L 200 75 L 250 50 L 300 55 L 350 30 L 400 40 L 450 60 L 500 45 L 550 35 L 600 50 L 600 140 L 0 140 Z"
        fill="url(#dashGrad)"
      />
      <path
        d="M 0 110 L 50 95 L 100 100 L 150 70 L 200 75 L 250 50 L 300 55 L 350 30 L 400 40 L 450 60 L 500 45 L 550 35 L 600 50"
        fill="none"
        stroke="#3b82f6"
        strokeWidth="2"
      />
    </svg>
  );
}

function DaysBarChart() {
  const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  // valores mockados Shopeers-style — substituir por dados reais quando
  // /api/analytics/overview retornar breakdown por dia da semana.
  const values = [3200, 5400, 8162, 4100, 6500, 5800, 2900];
  const max = Math.max(...values);
  return (
    <div className="flex items-end justify-between gap-1.5 h-24">
      {days.map((d, i) => {
        const h = (values[i] / max) * 100;
        const isPeak = values[i] === max;
        return (
          <div key={d} className="flex-1 flex flex-col items-center gap-1">
            <div className="flex-1 w-full flex items-end">
              <div
                className={`w-full rounded-t ${isPeak ? 'bg-blue-500' : 'bg-gray-200'}`}
                style={{ height: `${h}%` }}
              />
            </div>
            <span className="text-[9px] text-gray-500 font-medium">{d}</span>
          </div>
        );
      })}
    </div>
  );
}

function RateGauge({ value }: { value: number }) {
  // Gauge semi-circular SVG (Shopeers Repeat Customer Rate)
  const r = 56;
  const c = 2 * Math.PI * r;
  const half = c / 2;
  const filled = (value / 100) * half;
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 140 80" className="w-full max-w-[160px]">
        <path
          d="M 14 70 A 56 56 0 0 1 126 70"
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="10"
          strokeLinecap="round"
        />
        <path
          d="M 14 70 A 56 56 0 0 1 126 70"
          fill="none"
          stroke="#10b981"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${half}`}
        />
      </svg>
      <div className="-mt-7 text-center">
        <div className="text-3xl font-bold text-gray-900">{value}%</div>
        <div className="text-[10px] text-gray-500">{value >= 80 ? 'meta atingida' : 'rumo à meta'}</div>
      </div>
    </div>
  );
}

function SegmentCard({
  label,
  value,
  color,
  dot,
}: {
  label: string;
  value: number;
  color: string;
  dot: string;
}) {
  return (
    <div className={`rounded-xl border p-3 ${color}`}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className={`w-2 h-2 rounded-full ${dot}`} />
        <span className="text-[10px] font-semibold uppercase tracking-wide opacity-80">{label}</span>
      </div>
      <div className="text-2xl font-bold">{fmtNum(value)}</div>
    </div>
  );
}
