'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MessageSquare, Users, Bot, CalendarCheck, TrendingUp, Clock, ArrowRight } from 'lucide-react';
import { api } from '../../../lib/api';
import { AgentTrainingWidget } from '../../../components/dashboard/AgentTrainingWidget';

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

export default function DashboardPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [recent, setRecent] = useState<RecentConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('7d');

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([
      api.get(`/api/analytics/overview?period=${period}`).then((res) => setData(res.data || res)),
      // PR #107 — Recent activity REAL (não mais mock). Últimas 5 conversas
      // por updatedAt. Cliente vê quem está conversando AGORA, com link
      // direto pra abrir a thread no /conversations.
      api.get('/api/conversations?limit=5').then((res) => setRecent(res.data || res || [])),
    ])
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [period]);

  function formatRelativeTime(iso: string): string {
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.round(diffMs / 60000);
    if (mins < 1) return 'agora';
    if (mins < 60) return `${mins} min`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.round(hours / 24);
    return `${days}d`;
  }

  const kpis = data ? [
    { label: 'Mensagens', value: data.totalMessages, icon: MessageSquare, color: 'text-blue-600 bg-blue-50' },
    { label: 'Taxa de Automação', value: `${data.automationRate}%`, icon: Bot, color: 'text-green-600 bg-green-50' },
    { label: 'Conversas Abertas', value: data.openConversations, icon: TrendingUp, color: 'text-orange-600 bg-orange-50' },
    { label: 'Novos Contatos', value: data.newContacts, icon: Users, color: 'text-purple-600 bg-purple-50' },
    { label: 'Finalizadas', value: data.closedConversations, icon: CalendarCheck, color: 'text-teal-600 bg-teal-50' },
    { label: 'CSAT', value: data.csat.toFixed(1), icon: Clock, color: 'text-yellow-600 bg-yellow-50' },
  ] : [];

  return (
    <div>
      {/* PR #106 — AgentTrainingWidget substitui Welcome widget hardcoded.
          Lê /api/ai-training/status (não localStorage) → dados sempre frescos
          do DB. Renderiza ${agent.name} dinâmico. Mostra nextActions proativas
          do backend. Aparece enquanto agente não atinge level=expert. */}
      <AgentTrainingWidget />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Visão geral do seu atendimento</p>
        </div>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="24h">Últimas 24h</option>
          <option value="7d">Últimos 7 dias</option>
          <option value="30d">Últimos 30 dias</option>
        </select>
      </div>

      {/* KPI Cards */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl p-5 border border-gray-100 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-20 mb-3" />
              <div className="h-8 bg-gray-200 rounded w-16" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="bg-white rounded-xl p-5 border border-gray-100 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{kpi.label}</span>
                <div className={`p-1.5 rounded-lg ${kpi.color}`}>
                  <kpi.icon size={16} />
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900">{kpi.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* PR #107 — Activity REAL (substituiu mock). Lê /api/conversations
          últimas 5 + /api/analytics/overview pra distribuição status. */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">Atividade Recente</h3>
            <Link
              href="/conversations"
              className="text-xs text-primary-600 hover:text-primary-700 font-medium inline-flex items-center gap-1"
            >
              Ver todas
              <ArrowRight size={12} />
            </Link>
          </div>
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-10 bg-gray-50 rounded animate-pulse" />
              ))}
            </div>
          ) : recent.length === 0 ? (
            <div className="text-center py-10">
              <MessageSquare size={32} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-500">Nenhuma conversa ainda</p>
              <p className="text-xs text-gray-400 mt-1">
                Conecte seu WhatsApp em <Link href="/settings" className="text-primary-600 hover:underline">Configurações</Link> pra começar.
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {recent.map((conv) => {
                const lastMsg = conv.messages?.[0]?.content || 'Sem mensagens';
                const displayName = conv.contact?.name || conv.contact?.phone || 'Desconhecido';
                return (
                  <Link
                    key={conv.id}
                    href={`/conversations?id=${conv.id}`}
                    className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0 hover:bg-gray-50 -mx-2 px-2 rounded-lg transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-8 h-8 rounded-full bg-secondary-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
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
                      <span className="text-xs text-gray-400">{formatRelativeTime(conv.updatedAt)}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">Distribuição por Status</h3>
            <span className="text-xs text-gray-400">Período: {period === '24h' ? 'últimas 24h' : period === '30d' ? '30 dias' : '7 dias'}</span>
          </div>
          {loading || !data ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="space-y-1">
                  <div className="h-3 bg-gray-50 rounded w-1/3 animate-pulse" />
                  <div className="h-2 bg-gray-50 rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : (
            (() => {
              const items = [
                { label: 'Abertas (em andamento)', value: data.openConversations, color: 'bg-green-500' },
                { label: 'Fechadas no período', value: data.closedConversations, color: 'bg-gray-400' },
                { label: 'Novos contatos', value: data.newContacts, color: 'bg-blue-500' },
              ];
              const max = Math.max(...items.map((i) => i.value), 1);
              const totalAll = items.reduce((s, i) => s + i.value, 0);
              if (totalAll === 0) {
                return (
                  <div className="text-center py-10">
                    <TrendingUp size={32} className="mx-auto text-gray-300 mb-2" />
                    <p className="text-sm text-gray-500">Sem dados ainda no período</p>
                    <p className="text-xs text-gray-400 mt-1">As métricas aparecem assim que houver conversas.</p>
                  </div>
                );
              }
              return (
                <div className="space-y-4">
                  {items.map((item) => (
                    <div key={item.label}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-gray-600">{item.label}</span>
                        <span className="text-sm font-semibold text-gray-900">{item.value}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${item.color}`} style={{ width: `${(item.value / max) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()
          )}
        </div>
      </div>
    </div>
  );
}
