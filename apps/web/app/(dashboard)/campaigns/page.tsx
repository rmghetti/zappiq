'use client';

import { useEffect, useState } from 'react';
import { Megaphone, Plus, Send, BarChart2, Clock, CheckCircle, XCircle } from 'lucide-react';
import { api } from '../../../lib/api';

interface Campaign {
  id: string;
  name: string;
  type: string;
  status: string;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  repliedCount: number;
  failedCount: number;
  createdAt: string;
  template?: { name: string };
}

const STATUS_BADGE: Record<string, { bg: string; icon: any }> = {
  DRAFT: { bg: 'bg-gray-100 text-gray-600', icon: Clock },
  SCHEDULED: { bg: 'bg-blue-100 text-blue-700', icon: Clock },
  SENDING: { bg: 'bg-yellow-100 text-yellow-700', icon: Send },
  COMPLETED: { bg: 'bg-green-100 text-green-700', icon: CheckCircle },
  CANCELLED: { bg: 'bg-red-100 text-red-700', icon: XCircle },
};

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/campaigns')
      .then((res) => setCampaigns(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Campanhas</h1>
          <p className="text-sm text-gray-500 mt-1">Disparos em massa via WhatsApp</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600">
          <Plus size={16} /> Nova Campanha
        </button>
      </div>

      <div className="space-y-4">
        {loading ? (
          [...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 p-6 animate-pulse">
              <div className="h-5 bg-gray-200 rounded w-48 mb-3" />
              <div className="h-3 bg-gray-100 rounded w-full" />
            </div>
          ))
        ) : campaigns.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
            <Megaphone size={48} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">Nenhuma campanha criada</h3>
            <p className="text-sm text-gray-500 mb-4">Crie sua primeira campanha para disparar mensagens em massa.</p>
          </div>
        ) : (
          campaigns.map((c) => {
            const total = c.sentCount || 1;
            const StatusIcon = STATUS_BADGE[c.status]?.icon || Clock;
            return (
              <div key={c.id} className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-semibold text-gray-900">{c.name}</h3>
                    <p className="text-xs text-gray-400 mt-0.5">{c.type} · {new Date(c.createdAt).toLocaleDateString('pt-BR')}</p>
                  </div>
                  <span className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_BADGE[c.status]?.bg || 'bg-gray-100'}`}>
                    <StatusIcon size={12} /> {c.status}
                  </span>
                </div>
                {/* Stats bar */}
                <div className="grid grid-cols-4 gap-4">
                  <div className="text-center">
                    <p className="text-lg font-bold text-gray-900">{c.sentCount}</p>
                    <p className="text-[10px] text-gray-400 uppercase">Enviados</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-blue-600">{c.deliveredCount}</p>
                    <p className="text-[10px] text-gray-400 uppercase">Entregues</p>
                    <div className="h-1 bg-gray-100 rounded-full mt-1"><div className="h-full bg-blue-400 rounded-full" style={{ width: `${(c.deliveredCount / total) * 100}%` }} /></div>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-green-600">{c.readCount}</p>
                    <p className="text-[10px] text-gray-400 uppercase">Lidos</p>
                    <div className="h-1 bg-gray-100 rounded-full mt-1"><div className="h-full bg-green-400 rounded-full" style={{ width: `${(c.readCount / total) * 100}%` }} /></div>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-purple-600">{c.repliedCount}</p>
                    <p className="text-[10px] text-gray-400 uppercase">Respostas</p>
                    <div className="h-1 bg-gray-100 rounded-full mt-1"><div className="h-full bg-purple-400 rounded-full" style={{ width: `${(c.repliedCount / total) * 100}%` }} /></div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
