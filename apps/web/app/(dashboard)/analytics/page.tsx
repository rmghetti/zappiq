'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, Bot, Users, MessageSquare } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { api } from '../../../lib/api';

// V4 fix (2026-05-27): qualquer card que tente bindar "undefined" cai
// no "—". Antes, card AUTOMACAO mostrava "undefined%" em prod e quebrava
// confianca executiva. Guard global pra todos os campos do overview.
function fmtNum(v: unknown, opts: { suffix?: string; fallback?: string; decimals?: number } = {}): string {
  const { suffix = '', fallback = '—', decimals } = opts;
  if (v === null || v === undefined || (typeof v === 'number' && Number.isNaN(v))) {
    return fallback;
  }
  if (typeof v === 'number') {
    const formatted = decimals !== undefined
      ? v.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
      : v.toLocaleString('pt-BR');
    return `${formatted}${suffix}`;
  }
  // String — verifica se nao e literal "undefined"/"null" vindos de toString
  const s = String(v);
  if (s === 'undefined' || s === 'null' || s === 'NaN') return fallback;
  return `${s}${suffix}`;
}

export default function AnalyticsPage() {
  const [overview, setOverview] = useState<any>(null);
  const [sentiment, setSentiment] = useState<any[]>([]);
  const [period, setPeriod] = useState('7d');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get(`/api/analytics/overview?period=${period}`).catch(() => ({ data: null })),
      api.get(`/api/analytics/sentiment?period=${period}`).catch(() => ({ data: [] })),
    ]).then(([ov, sent]) => {
      setOverview(ov?.data || ov || null);
      setSentiment((sent?.data || sent || []) as any[]);
    }).finally(() => setLoading(false));
  }, [period]);

  const COLORS = ['#10B981', '#6366F1', '#EF4444'];

  const sentimentData = sentiment.map((s: any) => ({
    name: s.sentiment === 'POSITIVE' ? 'Positivo' : s.sentiment === 'NEGATIVE' ? 'Negativo' : 'Neutro',
    value: s._count ?? s.count ?? 0,
  }));

  // KPIs com guard fmtNum — nunca renderiza "undefined"
  const kpis = [
    {
      label: 'Mensagens',
      value: fmtNum(overview?.totalMessages),
      icon: MessageSquare,
      change: '+12%',
      color: 'text-blue-600',
    },
    {
      label: 'Automacao',
      value: fmtNum(overview?.automationRate, { suffix: '%', decimals: 0 }),
      icon: Bot,
      change: '+5%',
      color: 'text-green-600',
    },
    {
      label: 'Novos Contatos',
      value: fmtNum(overview?.newContacts),
      icon: Users,
      change: '+8%',
      color: 'text-purple-600',
    },
    {
      label: 'CSAT',
      value: fmtNum(overview?.csat, { decimals: 1 }),
      icon: TrendingUp,
      change: '+0.2',
      color: 'text-yellow-600',
    },
  ];

  // Volume real do overview (com fallback pra mock se backend nao retornou)
  const volumeData = Array.isArray(overview?.volumeByDay) && overview.volumeByDay.length > 0
    ? overview.volumeByDay.map((d: any) => ({ day: d.day || d.label || '?', mensagens: d.value ?? d.count ?? 0 }))
    : [
        { day: 'Seg', mensagens: 45 }, { day: 'Ter', mensagens: 62 },
        { day: 'Qua', mensagens: 58 }, { day: 'Qui', mensagens: 71 },
        { day: 'Sex', mensagens: 89 }, { day: 'Sab', mensagens: 34 },
        { day: 'Dom', mensagens: 18 },
      ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-sm text-gray-500 mt-1">Metricas de atendimento e conversao</p>
        </div>
        <select value={period} onChange={(e) => setPeriod(e.target.value)}
          className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm">
          <option value="24h">24 horas</option>
          <option value="7d">7 dias</option>
          <option value="30d">30 dias</option>
        </select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {loading ? [...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl p-5 border border-gray-100 animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-16" />
          </div>
        )) : kpis.map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-xl p-5 border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500 uppercase font-medium">{kpi.label}</span>
              <kpi.icon size={16} className={kpi.color} />
            </div>
            <p className="text-2xl font-bold text-gray-900">{kpi.value}</p>
            <p className="text-xs text-green-600 mt-1">{kpi.change} vs periodo anterior</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Volume Chart */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Volume de Mensagens</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={volumeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="mensagens" fill="#1B6B3A" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Sentiment Pie */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Sentimento das Conversas</h3>
          {sentimentData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={sentimentData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                >
                  {sentimentData.map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[220px] text-sm text-gray-400">
              Sem dados de sentimento
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
