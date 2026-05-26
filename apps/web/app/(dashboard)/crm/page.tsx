'use client';

/**
 * /crm — Pipeline de Vendas (CRM Onda 3a, PR #217)
 *
 * Mudanças vs versão anterior:
 *   1. Barra de 6 KPIs no topo (win rate, ticket médio, sales velocity,
 *      ciclo médio, forecast, abertos). Carregada de /api/crm/metrics.
 *   2. Drag-and-drop REAL entre colunas via HTML5 nativo (zero dependência).
 *      Substituiu os 3 botõezinhos "quick stage move" que eram clunky.
 *   3. Top 3 motivos de perda + barra de conversão por estágio no rodapé
 *      (compacto, não invade o kanban).
 *
 * Drag-and-drop:
 *   - draggable=true em cada card + onDragStart guarda o dealId
 *   - onDragOver na coluna previne default (permite drop)
 *   - onDrop pega dealId, chama PUT /api/deals/:id/stage, otimista update
 *   - Highlight visual da coluna alvo via state `dragOverStage`
 */

import { useEffect, useState, useCallback } from 'react';
import { Target, Plus, DollarSign, User, TrendingUp, Clock, AlertTriangle } from 'lucide-react';
import { api } from '../../../lib/api';
import { DealFormModal } from '../../../components/crm/DealFormModal';
import { LossReasonModal } from '../../../components/crm/LossReasonModal'; // PR #220 CRM 3c

interface Deal {
  id: string;
  title: string;
  value: number | null;
  stage: string;
  contact: { id: string; name: string; phone: string; avatarUrl?: string };
  updatedAt: string;
}

interface CrmMetrics {
  windowDays: number;
  kpis: {
    winRate: number;
    ticketMedio: number;
    salesVelocity: number;
    avgSalesCycleDays: number;
    forecast: number;
    totalAbertos: number;
    totalFechadosJanela: number;
    wonsJanela: number;
    lostsJanela: number;
  };
  conversaoPorEstagio: Array<{ stage: string; passou: number; total: number; percentual: number }>;
  motivosPerda: Array<{ reason: string; count: number }>;
  // PR #220 (CRM 3c): forecast pipeline-weighted breakdown por estágio.
  forecastBreakdown?: Array<{
    stage: string;
    probability: number;
    count: number;
    valorBruto: number;
    valorProjetado: number;
  }>;
}

const STAGES = [
  { key: 'new', label: 'Novo', color: 'border-t-blue-400' },
  { key: 'qualified', label: 'Qualificado', color: 'border-t-yellow-400' },
  { key: 'proposal', label: 'Proposta', color: 'border-t-orange-400' },
  { key: 'negotiation', label: 'Negociação', color: 'border-t-purple-400' },
  { key: 'won', label: 'Ganho', color: 'border-t-green-500' },
  { key: 'lost', label: 'Perdido', color: 'border-t-red-400' },
];

const LOSS_REASON_LABELS: Record<string, string> = {
  price: 'Preço',
  competitor: 'Concorrente',
  timing: 'Timing',
  no_response: 'Sem resposta',
  not_qualified: 'Não qualificado',
  other: 'Outro',
  outro: 'Outro',
};

function fmtBRL(n: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n || 0);
}

function fmtPct(n: number, digits = 0): string {
  return `${(n * 100).toFixed(digits)}%`;
}

export default function CrmPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [metrics, setMetrics] = useState<CrmMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [initialStage, setInitialStage] = useState('new');
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  // PR #220: modal de motivo de perda quando arrasta pra "Perdido"
  const [lossModal, setLossModal] = useState<{ deal: Deal } | null>(null);

  const fetchDeals = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get('/api/deals').catch(() => ({ data: [] })),
      api.get('/api/crm/metrics').catch(() => null),
    ])
      .then(([d, m]: any[]) => {
        setDeals(d?.data || d || []);
        setMetrics(m || null);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchDeals();
  }, [fetchDeals]);

  function openCreate(stage = 'new') {
    setInitialStage(stage);
    setModalOpen(true);
  }

  async function moveStage(dealId: string, newStage: string, lossReason?: string) {
    // Update otimista — UI muda na hora, request roda em background
    const previous = deals;
    setDeals((prev) => prev.map((d) => (d.id === dealId ? { ...d, stage: newStage } : d)));
    try {
      const payload: { stage: string; lossReason?: string } = { stage: newStage };
      if (newStage === 'lost' && lossReason) payload.lossReason = lossReason;
      await api.put(`/api/deals/${dealId}/stage`, payload);
      // Refresh métricas (deal mudou stage → conversão muda)
      api.get('/api/crm/metrics').then((m: any) => setMetrics(m || null)).catch(() => {});
    } catch {
      // Rollback se falhar
      setDeals(previous);
    }
  }

  // ─── Drag-and-drop handlers (HTML5 nativo) ─────────────────────────
  function handleDragStart(e: React.DragEvent<HTMLDivElement>, dealId: string) {
    e.dataTransfer.setData('text/plain', dealId);
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>, stageKey: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverStage !== stageKey) setDragOverStage(stageKey);
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    // Só limpa se realmente saiu da área (não em filhos)
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverStage(null);
    }
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>, stageKey: string) {
    e.preventDefault();
    setDragOverStage(null);
    const dealId = e.dataTransfer.getData('text/plain');
    if (!dealId) return;
    const deal = deals.find((d) => d.id === dealId);
    if (!deal || deal.stage === stageKey) return;
    // PR #220: drop em "Perdido" abre modal pra capturar lossReason ANTES de mover.
    if (stageKey === 'lost') {
      setLossModal({ deal });
      return;
    }
    moveStage(dealId, stageKey);
  }

  const dealsByStage = (stage: string) => deals.filter((d) => d.stage === stage);
  const stageTotal = (stage: string) =>
    dealsByStage(stage).reduce((acc, d) => acc + (Number(d.value) || 0), 0);

  return (
    <div>
      {/* ─── Header + CTA ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pipeline de Vendas</h1>
          <p className="text-sm text-gray-500 mt-1">
            {deals.length} deals · arraste cards entre as colunas pra mover de estágio
          </p>
        </div>
        <button
          onClick={() => openCreate('new')}
          className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600"
        >
          <Plus size={16} /> Novo Deal
        </button>
      </div>

      {/* ─── Barra de 6 KPIs (Onda 3a) ───────────────────────────── */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
          <KpiCard
            label="Win Rate"
            value={fmtPct(metrics.kpis.winRate, 1)}
            sub={`${metrics.kpis.wonsJanela} de ${metrics.kpis.totalFechadosJanela} fechados`}
            tint="green"
            icon={<TrendingUp size={14} />}
          />
          <KpiCard
            label="Ticket Médio"
            value={fmtBRL(metrics.kpis.ticketMedio)}
            sub={`últimos ${metrics.windowDays}d`}
            tint="blue"
            icon={<DollarSign size={14} />}
          />
          <KpiCard
            label="Forecast"
            value={fmtBRL(metrics.kpis.forecast)}
            sub={`${metrics.kpis.totalAbertos} deals abertos`}
            tint="purple"
            icon={<Target size={14} />}
          />
          <KpiCard
            label="Sales Velocity"
            value={`${fmtBRL(metrics.kpis.salesVelocity)}/dia`}
            sub="receita esperada/dia"
            tint="indigo"
            icon={<TrendingUp size={14} />}
          />
          <KpiCard
            label="Ciclo Médio"
            value={`${metrics.kpis.avgSalesCycleDays.toFixed(0)} dias`}
            sub="lead → ganho"
            tint="amber"
            icon={<Clock size={14} />}
          />
          <KpiCard
            label="Perdas"
            value={String(metrics.kpis.lostsJanela)}
            sub={
              metrics.motivosPerda.length > 0
                ? `top: ${LOSS_REASON_LABELS[metrics.motivosPerda[0].reason] || metrics.motivosPerda[0].reason}`
                : 'sem dados'
            }
            tint="red"
            icon={<AlertTriangle size={14} />}
          />
        </div>
      )}

      {/* ─── Kanban com drag-and-drop ─────────────────────────────── */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {STAGES.map((stage) => {
          const isHover = dragOverStage === stage.key;
          return (
            <div
              key={stage.key}
              onDragOver={(e) => handleDragOver(e, stage.key)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, stage.key)}
              className={`flex-shrink-0 w-[280px] rounded-xl border-t-4 ${stage.color} transition-colors ${
                isHover ? 'bg-blue-50 ring-2 ring-blue-300' : 'bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-between px-4 py-3">
                <div>
                  <h3 className="text-sm font-semibold text-gray-700">{stage.label}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {dealsByStage(stage.key).length} deals · {fmtBRL(stageTotal(stage.key))}
                  </p>
                </div>
                <button
                  onClick={() => openCreate(stage.key)}
                  className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-700"
                  title={`Criar deal em ${stage.label}`}
                >
                  <Plus size={14} />
                </button>
              </div>

              <div className="px-3 pb-3 space-y-2 min-h-[200px]">
                {loading ? (
                  <div className="bg-white rounded-lg p-4 animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                  </div>
                ) : (
                  dealsByStage(stage.key).map((deal) => (
                    <div
                      key={deal.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, deal.id)}
                      className="bg-white rounded-lg p-3 border border-gray-100 shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing"
                    >
                      <p className="text-sm font-medium text-gray-900 mb-2">{deal.title}</p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded-full bg-primary-100 flex items-center justify-center">
                            <User size={10} className="text-primary-700" />
                          </div>
                          <span className="text-xs text-gray-500">
                            {deal.contact?.name || 'Sem contato'}
                          </span>
                        </div>
                        {deal.value && (
                          <span className="text-xs font-semibold text-green-600 flex items-center gap-0.5">
                            <DollarSign size={10} />
                            {fmtBRL(Number(deal.value))}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── Rodapé analítico (conversão + motivos perda + forecast) ── */}
      {metrics && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-6">
          {/* Funil de conversão por estágio */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">
              Conversão por estágio · últimos {metrics.windowDays}d
            </h4>
            <div className="space-y-2">
              {metrics.conversaoPorEstagio.map((c) => {
                const stage = STAGES.find((s) => s.key === c.stage);
                return (
                  <div key={c.stage}>
                    <div className="flex items-center justify-between text-xs text-gray-700 mb-0.5">
                      <span className="font-medium">{stage?.label || c.stage}</span>
                      <span className="text-gray-500">
                        {c.passou}/{c.total} · {fmtPct(c.percentual, 0)}
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary-500 transition-all"
                        style={{ width: `${Math.min(100, c.percentual * 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* PR #220 CRM 3c — Forecast breakdown por estágio */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">
              De onde vem o forecast · pipeline-weighted
            </h4>
            {!metrics.forecastBreakdown || metrics.forecastBreakdown.length === 0 ? (
              <p className="text-xs text-gray-500 italic">Sem deals abertos pra projetar.</p>
            ) : (
              <div className="space-y-2">
                {metrics.forecastBreakdown
                  .filter((b) => b.count > 0)
                  .map((b) => {
                    const stage = STAGES.find((s) => s.key === b.stage);
                    const maxBruto = Math.max(...metrics.forecastBreakdown!.map((x) => x.valorBruto));
                    return (
                      <div key={b.stage}>
                        <div className="flex items-center justify-between text-xs text-gray-700 mb-0.5">
                          <span className="font-medium">
                            {stage?.label || b.stage}
                            <span className="ml-1 text-[10px] text-gray-400">
                              ({fmtPct(b.probability, 0)})
                            </span>
                          </span>
                          <span className="text-gray-500">
                            {fmtBRL(b.valorProjetado)} de {fmtBRL(b.valorBruto)}
                          </span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden relative">
                          {/* Valor bruto (cinza claro) */}
                          <div
                            className="absolute h-full bg-gray-200"
                            style={{ width: maxBruto > 0 ? `${(b.valorBruto / maxBruto) * 100}%` : '0' }}
                          />
                          {/* Valor projetado (azul = bruto × prob) */}
                          <div
                            className="absolute h-full bg-purple-500 transition-all"
                            style={{ width: maxBruto > 0 ? `${(b.valorProjetado / maxBruto) * 100}%` : '0' }}
                          />
                        </div>
                        <div className="text-[10px] text-gray-400 mt-0.5">
                          {b.count} deal{b.count !== 1 ? 's' : ''}
                        </div>
                      </div>
                    );
                  })}
                <div className="pt-2 mt-2 border-t border-gray-100 flex items-center justify-between text-xs">
                  <span className="font-semibold text-gray-700">Total forecast</span>
                  <span className="font-bold text-purple-700">{fmtBRL(metrics.kpis.forecast)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Top 3 motivos de perda */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">
              Por que perdemos · últimos {metrics.windowDays}d
            </h4>
            {metrics.motivosPerda.length === 0 ? (
              <p className="text-xs text-gray-500 italic">
                Sem deals perdidos nesse período. Marque motivo de perda no card pra ter insights.
              </p>
            ) : (
              <div className="space-y-2">
                {metrics.motivosPerda.map((m, i) => {
                  const label = LOSS_REASON_LABELS[m.reason] || m.reason;
                  const max = metrics.motivosPerda[0].count;
                  return (
                    <div key={m.reason}>
                      <div className="flex items-center justify-between text-xs text-gray-700 mb-0.5">
                        <span className="font-medium">
                          {i + 1}. {label}
                        </span>
                        <span className="text-gray-500">{m.count} deals</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-red-400 transition-all"
                          style={{ width: `${(m.count / max) * 100}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      <DealFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={fetchDeals}
        initialStage={initialStage}
      />

      {/* PR #220 CRM 3c — Modal "Por que perdemos?" */}
      <LossReasonModal
        open={!!lossModal}
        dealTitle={lossModal?.deal.title || ''}
        onCancel={() => setLossModal(null)}
        onConfirm={(reason) => {
          if (lossModal) {
            moveStage(lossModal.deal.id, 'lost', reason);
            setLossModal(null);
          }
        }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// KpiCard — card minimalista de KPI executivo
// ─────────────────────────────────────────────────────────────────────
function KpiCard({
  label,
  value,
  sub,
  tint,
  icon,
}: {
  label: string;
  value: string;
  sub: string;
  tint: 'green' | 'blue' | 'purple' | 'indigo' | 'amber' | 'red';
  icon: React.ReactNode;
}) {
  const colors: Record<typeof tint, { bg: string; text: string; iconBg: string }> = {
    green: { bg: 'bg-green-50 border-green-200', text: 'text-green-900', iconBg: 'bg-green-100 text-green-700' },
    blue: { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-900', iconBg: 'bg-blue-100 text-blue-700' },
    purple: { bg: 'bg-purple-50 border-purple-200', text: 'text-purple-900', iconBg: 'bg-purple-100 text-purple-700' },
    indigo: { bg: 'bg-indigo-50 border-indigo-200', text: 'text-indigo-900', iconBg: 'bg-indigo-100 text-indigo-700' },
    amber: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-900', iconBg: 'bg-amber-100 text-amber-700' },
    red: { bg: 'bg-red-50 border-red-200', text: 'text-red-900', iconBg: 'bg-red-100 text-red-700' },
  };
  const c = colors[tint];
  return (
    <div className={`rounded-lg border p-3 ${c.bg}`}>
      <div className="flex items-center gap-2 mb-1">
        <div className={`w-6 h-6 rounded flex items-center justify-center ${c.iconBg}`}>{icon}</div>
        <span className={`text-[10px] font-semibold uppercase tracking-wide ${c.text} opacity-70`}>
          {label}
        </span>
      </div>
      <div className={`text-lg font-bold ${c.text} leading-tight`}>{value}</div>
      <div className="text-[10px] text-gray-500 mt-0.5 truncate" title={sub}>
        {sub}
      </div>
    </div>
  );
}
