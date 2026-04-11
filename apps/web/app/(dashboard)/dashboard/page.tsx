'use client';

import { useEffect, useState } from 'react';
import { MessageSquare, Users, Bot, CalendarCheck, TrendingUp, Clock } from 'lucide-react';
import { api } from '../../../lib/api';

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

export default function DashboardPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('7d');

  useEffect(() => {
    setLoading(true);
    api.get(`/api/analytics/overview?period=${period}`)
      .then((res) => setData(res.data || res))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [period]);

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

      {/* Activity section */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Atividade Recente</h3>
          <div className="space-y-3">
            {[
              { text: 'Nova conversa iniciada por +55 11 99999-0001', time: '2 min' },
              { text: 'Lead qualificado automaticamente pela IA', time: '5 min' },
              { text: 'Agendamento confirmado — Dra. Carla 14h', time: '12 min' },
              { text: 'Campanha "Volta às Aulas" finalizada', time: '1h' },
              { text: 'Novo documento adicionado à base de conhecimento', time: '2h' },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <span className="text-sm text-gray-700">{item.text}</span>
                <span className="text-xs text-gray-400 flex-shrink-0 ml-4">{item.time}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Distribuição por Status</h3>
          <div className="space-y-4">
            {[
              { label: 'Abertas', value: 45, color: 'bg-blue-500' },
              { label: 'Aguardando', value: 23, color: 'bg-yellow-500' },
              { label: 'Atribuídas', value: 18, color: 'bg-green-500' },
              { label: 'Fechadas (hoje)', value: 67, color: 'bg-gray-400' },
            ].map((item) => (
              <div key={item.label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-600">{item.label}</span>
                  <span className="text-sm font-semibold text-gray-900">{item.value}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${item.color}`} style={{ width: `${(item.value / 67) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
