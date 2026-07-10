'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Megaphone, Plus, Send, Clock, CheckCircle, XCircle, Trash2, Sparkles,
  Rocket, MessageSquare, Compass, TrendingUp, Zap, Reply, DollarSign,
  ArrowRight, ChevronDown, ChevronUp, AlertTriangle, Lightbulb,
} from 'lucide-react';
import { api } from '../../../lib/api';
import { CampaignFormModal } from '../../../components/campaigns/CampaignFormModal';
import { IzaStrategistModal } from '../../../components/campaigns/IzaStrategistModal';
import { ImpulsoUpsellModal, type ImpulsoEntitlement } from '../../../components/campaigns/ImpulsoUpsellModal';
import { SaibaMais } from '@/components/shared/SaibaMais';

interface CoachInsight {
  severity: 'good' | 'info' | 'warning';
  title: string;
  message: string;
}

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
  isImpulso?: boolean;
  objective?: string | null;
  channels?: string[] | null;
  template?: { name: string };
  coachInsights?: CoachInsight[];
}

const GRAD = 'bg-gradient-to-r from-[#2FB57A] via-[#2F7FB5] to-[#4A52D0]';
const GRAD_TEXT = 'bg-gradient-to-r from-[#2FB57A] via-[#2F7FB5] to-[#4A52D0] bg-clip-text text-transparent';

const STATUS_BADGE: Record<string, { bg: string; icon: any; label: string }> = {
  DRAFT: { bg: 'bg-gray-100 text-gray-600', icon: Clock, label: 'Rascunho' },
  SCHEDULED: { bg: 'bg-blue-100 text-blue-700', icon: Clock, label: 'Agendada' },
  SENDING: { bg: 'bg-amber-100 text-amber-700', icon: Send, label: 'Enviando' },
  COMPLETED: { bg: 'bg-green-100 text-green-700', icon: CheckCircle, label: 'Concluída' },
  CANCELLED: { bg: 'bg-red-100 text-red-700', icon: XCircle, label: 'Pausada' },
};

const PILLARS = [
  {
    icon: Sparkles,
    title: 'Iza Estrategista',
    desc: 'Descreva o objetivo em uma frase e a Iza monta a campanha inteira: público, mensagem, horário e verba.',
    status: 'ok' as const,
  },
  {
    icon: Send,
    title: 'Disparo omnichannel',
    desc: 'Envie para a sua base pelo WhatsApp, e-mail e SMS, com o custo do WhatsApp repassado de forma transparente.',
    status: 'ok' as const,
  },
  {
    icon: Compass,
    title: 'Copiloto & Coach',
    desc: 'A Iza acompanha os números de cada campanha e sugere o que ajustar para bater sua meta.',
    status: 'ok' as const,
  },
  {
    icon: TrendingUp,
    title: 'Loop de Performance',
    desc: 'Anúncios do Meta e Google trazem o lead para a conversa, e a venda volta para otimizar a mídia.',
    status: 'soon' as const,
  },
  {
    icon: Zap,
    title: 'Auto-otimização',
    desc: 'A Iza testa variações da campanha e concentra o volume na que mais vende, sozinha.',
    status: 'soon' as const,
  },
];

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [izaOpen, setIzaOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [howOpen, setHowOpen] = useState(true);
  const [entitlement, setEntitlement] = useState<ImpulsoEntitlement | null>(null);
  const [upsellOpen, setUpsellOpen] = useState(false);

  const fetchEntitlement = useCallback(() => {
    api.get('/api/impulso-access')
      .then((res) => setEntitlement(res.data || null))
      .catch(() => setEntitlement(null));
  }, []);

  // Intercepta as acoes: quem nao tem o Impulso ativo cai na vitrine/paywall.
  const guard = useCallback((action: () => void) => {
    if (entitlement?.enabled) action();
    else setUpsellOpen(true);
  }, [entitlement]);

  const fetchCampaigns = useCallback(() => {
    setLoading(true);
    api.get('/api/campaigns')
      .then((res) => setCampaigns(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSend = useCallback(async (id: string) => {
    if (!entitlement?.enabled) { setUpsellOpen(true); return; }
    if (!confirm('Disparar esta campanha agora? As mensagens serão enviadas para os contatos com consentimento de marketing.')) return;
    setBusyId(id);
    try {
      await api.post(`/api/campaigns/${id}/send`);
      fetchCampaigns();
    } catch {
      alert('Não foi possível disparar a campanha.');
    } finally {
      setBusyId(null);
    }
  }, [fetchCampaigns, entitlement]);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Excluir esta campanha? Esta ação não pode ser desfeita.')) return;
    setBusyId(id);
    try {
      await api.delete(`/api/campaigns/${id}`);
      fetchCampaigns();
    } catch {
      alert('Não foi possível excluir a campanha.');
    } finally {
      setBusyId(null);
    }
  }, [fetchCampaigns]);

  useEffect(() => { fetchCampaigns(); fetchEntitlement(); }, [fetchCampaigns, fetchEntitlement]);

  const metrics = useMemo(() => {
    const active = campaigns.filter((c) => c.status === 'SENDING' || c.status === 'SCHEDULED').length;
    const sent = campaigns.reduce((s, c) => s + (c.sentCount || 0), 0);
    const replied = campaigns.reduce((s, c) => s + (c.repliedCount || 0), 0);
    const replyRate = sent > 0 ? Math.round((replied / sent) * 100) : 0;
    return { active, sent, replyRate, total: campaigns.length };
  }, [campaigns]);

  const hasCampaigns = !loading && campaigns.length > 0;

  return (
    <div className="space-y-6">
      {/* ── Header ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">Zap Impulso</h1>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full text-white ${GRAD}`}>Campanhas</span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Sua central de vendas proativas. Crie campanhas com a Iza e acompanhe os resultados.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => guard(() => setIzaOpen(true))}
            className={`flex items-center gap-2 px-4 py-2 text-white rounded-lg text-sm font-semibold hover:opacity-95 shadow-sm ${GRAD}`}
          >
            <Sparkles size={16} /> Criar com a Iza
          </button>
          <SaibaMais featureKey="campaigns.iza-estrategista" />
          <button
            onClick={() => guard(() => setModalOpen(true))}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
          >
            <Plus size={16} /> Nova campanha
          </button>
        </div>
      </div>

      {/* Banner do teste do Zap Impulso — contagem regressiva (igual à faixa de
          trial da plataforma no topo, agora repetida dentro da página). */}
      {entitlement?.source === 'trial' && entitlement.trial && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-[#CDE9DA] bg-[#E4F3EC] px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-[#1B7A54]">
            <Sparkles size={15} className="flex-shrink-0" />
            <span>
              <b>Teste do Zap Impulso ativo</b> · {entitlement.trial.daysLeft} {entitlement.trial.daysLeft === 1 ? 'dia restante' : 'dias restantes'}.
              {' '}Depois disso o serviço é bloqueado até você contratar um plano.
            </span>
          </div>
          <button onClick={() => setUpsellOpen(true)} className="text-xs font-semibold text-[#3A3FA8] hover:underline self-start sm:self-auto whitespace-nowrap">
            Ver planos e contratar
          </button>
        </div>
      )}

      {/* Teste terminou e a conta não assinou — serviço bloqueado. */}
      {entitlement?.trialExpired && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-amber-800">
            <AlertTriangle size={15} className="flex-shrink-0" />
            <span><b>Seu teste do Zap Impulso terminou.</b> As campanhas ficam bloqueadas até você contratar um plano.</span>
          </div>
          <button onClick={() => setUpsellOpen(true)} className={`text-xs font-semibold text-white px-3 py-1.5 rounded-lg self-start sm:self-auto whitespace-nowrap ${GRAD}`}>
            Ver planos
          </button>
        </div>
      )}

      {/* ── Visão geral (métricas) ────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard icon={Megaphone} label="Campanhas ativas" value={metrics.active} hint="enviando ou agendadas" loading={loading} />
        <MetricCard icon={Send} label="Disparos" value={metrics.sent} hint="mensagens enviadas" loading={loading} />
        <MetricCard icon={Reply} label="Taxa de resposta" value={`${metrics.replyRate}%`} hint="quem respondeu" loading={loading} />
        <MetricCard icon={DollarSign} label="Receita atribuída" value="R$ 0" hint="conecte anúncios para medir" loading={loading} accent help="campaigns.metrica.receita-atribuida" />
      </div>

      {/* ── Como funciona o Impulso ───────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <button
          onClick={() => setHowOpen((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50"
        >
          <div className="flex items-center gap-3">
            <span className={`flex items-center justify-center w-9 h-9 rounded-xl text-white ${GRAD}`}>
              <Rocket size={18} />
            </span>
            <div>
              <h2 className="text-base font-bold text-gray-900">Como funciona o Impulso</h2>
              <p className="text-xs text-gray-500">A Iza cuida da campanha de ponta a ponta. Veja cada parte.</p>
            </div>
          </div>
          {howOpen ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
        </button>
        {howOpen && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-px bg-gray-100 border-t border-gray-100">
            {PILLARS.map((p) => {
              const Icon = p.icon;
              return (
                <div key={p.title} className="bg-white p-4 flex flex-col">
                  <div className="flex items-center justify-between">
                    <span className={`flex items-center justify-center w-8 h-8 rounded-lg ${p.status === 'ok' ? GRAD + ' text-white' : 'bg-gray-100 text-gray-400'}`}>
                      <Icon size={15} />
                    </span>
                    {p.status === 'ok'
                      ? <span className="text-[10px] font-semibold text-[#2FB57A] bg-[#E4F3EC] px-1.5 py-0.5 rounded">Disponível</span>
                      : <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">Em breve</span>}
                  </div>
                  <h3 className="text-sm font-semibold text-gray-900 mt-2.5">{p.title}</h3>
                  <p className="text-xs text-gray-500 mt-1 leading-snug">{p.desc}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Suas campanhas ────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <h2 className="text-base font-bold text-gray-900">Suas campanhas</h2>
            <SaibaMais featureKey="campaigns.status-badge" />
          </div>
          {hasCampaigns && <span className="text-xs text-gray-400">{campaigns.length} no total</span>}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 p-5 animate-pulse">
                <div className="h-5 bg-gray-200 rounded w-48 mb-3" />
                <div className="h-3 bg-gray-100 rounded w-full" />
              </div>
            ))}
          </div>
        ) : campaigns.length === 0 ? (
          <EmptyState onIza={() => guard(() => setIzaOpen(true))} onManual={() => guard(() => setModalOpen(true))} />
        ) : (
          <div className="space-y-3">
            {campaigns.map((c) => (
              <CampaignRow
                key={c.id}
                c={c}
                busy={busyId === c.id}
                onSend={() => handleSend(c.id)}
                onDelete={() => handleDelete(c.id)}
              />
            ))}
          </div>
        )}
      </div>

      <CampaignFormModal open={modalOpen} onClose={() => setModalOpen(false)} onSaved={fetchCampaigns} />
      <IzaStrategistModal
        open={izaOpen}
        onClose={() => setIzaOpen(false)}
        onCreated={fetchCampaigns}
        hasInstagram={entitlement?.hasInstagram ?? false}
      />
      <ImpulsoUpsellModal
        open={upsellOpen}
        entitlement={entitlement}
        onClose={() => setUpsellOpen(false)}
        onActivated={() => { fetchEntitlement(); setUpsellOpen(false); setIzaOpen(true); }}
      />
    </div>
  );
}

// ── Componentes ──────────────────────────────────────────

function MetricCard({ icon: Icon, label, value, hint, loading, accent, help }: {
  icon: any; label: string; value: string | number; hint: string; loading: boolean; accent?: boolean; help?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <div className="flex items-center gap-2 text-gray-400">
        <Icon size={15} className={accent ? 'text-[#4A52D0]' : ''} />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
        {help && <SaibaMais featureKey={help} />}
      </div>
      <div className="mt-2 text-2xl font-bold text-gray-900 tabular-nums">
        {loading ? <span className="inline-block h-7 w-16 bg-gray-100 rounded animate-pulse" /> : value}
      </div>
      <div className="text-[11px] text-gray-400 mt-0.5">{hint}</div>
    </div>
  );
}

function CampaignRow({ c, busy, onSend, onDelete }: {
  c: Campaign; busy: boolean; onSend: () => void; onDelete: () => void;
}) {
  const total = c.sentCount || 1;
  const badge = STATUS_BADGE[c.status] || STATUS_BADGE.DRAFT;
  const StatusIcon = badge.icon;
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4 gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-gray-900 truncate">{c.name}</h3>
            {c.isImpulso && <Sparkles size={13} className="text-[#4A52D0] flex-shrink-0" />}
          </div>
          <p className="text-xs text-gray-400 mt-0.5 truncate">
            {c.objective || c.type} · {new Date(c.createdAt).toLocaleDateString('pt-BR')}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${badge.bg}`}>
            <StatusIcon size={12} /> {badge.label}
          </span>
          {['DRAFT', 'SCHEDULED', 'CANCELLED'].includes(c.status) && (
            <button
              onClick={onSend}
              disabled={busy}
              className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg text-white hover:opacity-95 disabled:opacity-50 ${GRAD}`}
              title="Disparar campanha"
            >
              <Send size={12} /> Disparar
            </button>
          )}
          <button
            onClick={onDelete}
            disabled={busy}
            className="flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-50"
            title="Excluir campanha"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
      <div className="flex items-center gap-1 mb-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Funil de entrega</span>
        <SaibaMais featureKey="campaigns.funil-entrega" />
      </div>
      <div className="grid grid-cols-4 gap-4">
        <Stat value={c.sentCount} label="Enviados" />
        <Stat value={c.deliveredCount} label="Entregues" color="text-blue-600" bar="bg-blue-400" pct={(c.deliveredCount / total) * 100} />
        <Stat value={c.readCount} label="Lidos" color="text-green-600" bar="bg-green-400" pct={(c.readCount / total) * 100} />
        <Stat value={c.repliedCount} label="Respostas" color="text-[#4A52D0]" bar="bg-[#8B90F0]" pct={(c.repliedCount / total) * 100} />
      </div>
      {(c.coachInsights?.length ?? 0) > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
          <div className="flex items-center gap-1 mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Insights do Coach</span>
            <SaibaMais featureKey="campaigns.coach-insights" />
          </div>
          {c.coachInsights!.map((insight, i) => (
            <CoachTip key={i} insight={insight} />
          ))}
        </div>
      )}
    </div>
  );
}

const COACH_STYLE: Record<CoachInsight['severity'], { bg: string; text: string; icon: any }> = {
  good: { bg: 'bg-[#E4F3EC]', text: 'text-[#1B7A54]', icon: TrendingUp },
  info: { bg: 'bg-[#ECEDFA]', text: 'text-[#3A3FA8]', icon: Lightbulb },
  warning: { bg: 'bg-amber-50', text: 'text-amber-800', icon: AlertTriangle },
};

function CoachTip({ insight }: { insight: CoachInsight }) {
  const style = COACH_STYLE[insight.severity];
  const Icon = style.icon;
  return (
    <div className={`flex items-start gap-2.5 rounded-lg px-3 py-2.5 ${style.bg}`}>
      <Icon size={15} className={`flex-shrink-0 mt-0.5 ${style.text}`} />
      <div>
        <p className={`text-xs font-semibold ${style.text}`}>{insight.title}</p>
        <p className="text-xs text-gray-600 mt-0.5 leading-snug">{insight.message}</p>
      </div>
    </div>
  );
}

function Stat({ value, label, color, bar, pct }: { value: number; label: string; color?: string; bar?: string; pct?: number }) {
  return (
    <div className="text-center">
      <p className={`text-lg font-bold tabular-nums ${color || 'text-gray-900'}`}>{value}</p>
      <p className="text-[10px] text-gray-400 uppercase">{label}</p>
      {bar != null && (
        <div className="h-1 bg-gray-100 rounded-full mt-1">
          <div className={`h-full ${bar} rounded-full`} style={{ width: `${Math.min(100, pct || 0)}%` }} />
        </div>
      )}
    </div>
  );
}

function EmptyState({ onIza, onManual }: { onIza: () => void; onManual: () => void }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-8 sm:p-12 text-center">
      <span className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl text-white mb-4 ${GRAD}`}>
        <Sparkles size={26} />
      </span>
      <h3 className="text-xl font-bold text-gray-900">
        Sua primeira campanha em <span className={GRAD_TEXT}>uma frase</span>
      </h3>
      <p className="text-sm text-gray-500 mt-2 max-w-md mx-auto">
        Diga à Iza o que você quer, por exemplo <em>"reativar quem sumiu há 30 dias com 15% de desconto"</em>,
        e ela monta a campanha completa: público, mensagem, horário e estimativa. Você só aprova.
      </p>
      <div className="flex items-center justify-center gap-2 mt-6">
        <button
          onClick={onIza}
          className={`inline-flex items-center gap-2 px-5 py-2.5 text-white rounded-lg text-sm font-semibold hover:opacity-95 ${GRAD}`}
        >
          <Sparkles size={16} /> Criar com a Iza <ArrowRight size={16} />
        </button>
        <button
          onClick={onManual}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
        >
          Prefiro montar manualmente
        </button>
      </div>
      <div className="flex items-center justify-center gap-6 mt-8 pt-6 border-t border-gray-100 text-xs text-gray-400">
        <span className="flex items-center gap-1.5"><MessageSquare size={13} /> WhatsApp, e-mail e SMS</span>
        <span className="flex items-center gap-1.5"><CheckCircle size={13} /> Só dispara com consentimento</span>
        <span className="flex items-center gap-1.5"><Sparkles size={13} /> Copy na voz da sua marca</span>
      </div>
    </div>
  );
}
