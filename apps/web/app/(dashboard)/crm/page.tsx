'use client';

import { useEffect, useState } from 'react';
import { Target, Plus, DollarSign, User } from 'lucide-react';
import { api } from '../../../lib/api';

interface Deal {
  id: string;
  title: string;
  value: number | null;
  stage: string;
  contact: { id: string; name: string; phone: string; avatarUrl?: string };
  updatedAt: string;
}

const STAGES = [
  { key: 'new', label: 'Novo', color: 'border-t-blue-400' },
  { key: 'qualified', label: 'Qualificado', color: 'border-t-yellow-400' },
  { key: 'proposal', label: 'Proposta', color: 'border-t-orange-400' },
  { key: 'negotiation', label: 'Negociação', color: 'border-t-purple-400' },
  { key: 'won', label: 'Ganho', color: 'border-t-green-500' },
  { key: 'lost', label: 'Perdido', color: 'border-t-red-400' },
];

export default function CrmPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/deals')
      .then((res) => setDeals(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function moveStage(dealId: string, newStage: string) {
    try {
      await api.put(`/api/deals/${dealId}/stage`, { stage: newStage });
      setDeals((prev) => prev.map((d) => d.id === dealId ? { ...d, stage: newStage } : d));
    } catch {}
  }

  const dealsByStage = (stage: string) => deals.filter((d) => d.stage === stage);
  const stageTotal = (stage: string) => dealsByStage(stage).reduce((acc, d) => acc + (Number(d.value) || 0), 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pipeline de Vendas</h1>
          <p className="text-sm text-gray-500 mt-1">{deals.length} deals no pipeline</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600">
          <Plus size={16} /> Novo Deal
        </button>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {STAGES.map((stage) => (
          <div key={stage.key} className={`flex-shrink-0 w-[280px] bg-gray-50 rounded-xl border-t-4 ${stage.color}`}>
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-700">{stage.label}</h3>
                <p className="text-xs text-gray-400 mt-0.5">{dealsByStage(stage.key).length} deals · R$ {stageTotal(stage.key).toLocaleString('pt-BR')}</p>
              </div>
            </div>

            <div className="px-3 pb-3 space-y-2 min-h-[200px]">
              {loading ? (
                <div className="bg-white rounded-lg p-4 animate-pulse"><div className="h-4 bg-gray-200 rounded w-3/4" /></div>
              ) : (
                dealsByStage(stage.key).map((deal) => (
                  <div key={deal.id} className="bg-white rounded-lg p-3 border border-gray-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                    <p className="text-sm font-medium text-gray-900 mb-2">{deal.title}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full bg-primary-100 flex items-center justify-center">
                          <User size={10} className="text-primary-700" />
                        </div>
                        <span className="text-xs text-gray-500">{deal.contact?.name || 'Sem contato'}</span>
                      </div>
                      {deal.value && (
                        <span className="text-xs font-semibold text-green-600 flex items-center gap-0.5">
                          <DollarSign size={10} /> R$ {Number(deal.value).toLocaleString('pt-BR')}
                        </span>
                      )}
                    </div>
                    {/* Quick stage move buttons */}
                    {stage.key !== 'won' && stage.key !== 'lost' && (
                      <div className="flex gap-1 mt-2">
                        {STAGES.filter((s) => s.key !== stage.key && s.key !== 'lost').slice(0, 3).map((s) => (
                          <button key={s.key} onClick={() => moveStage(deal.id, s.key)}
                            className="text-[9px] px-1.5 py-0.5 rounded border border-gray-200 text-gray-500 hover:bg-gray-100">
                            {s.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
