'use client';

/**
 * ImpulsoUpsellModal — vitrine/paywall do add-on Impulso.
 *
 * Mostrada quando um cliente SEM o Impulso clica em qualquer ação da tela
 * de Campanhas. Apresenta os 3 planos com preços e um teste grátis de 7 dias
 * que a conta pode ativar (dentro do trial de 14 dias da plataforma OU já
 * como cliente ativo). Ativar o teste desbloqueia o Impulso na hora.
 */
import { useState } from 'react';
import { Sparkles, X, Check, Loader2, Rocket, ArrowRight, Info } from 'lucide-react';
import { api } from '../../lib/api';
import { ImpulsoPlanDetailModal } from './ImpulsoPlanDetailModal';
import type { PlanKey } from './impulsoPlansContent';

export interface ImpulsoEntitlement {
  enabled: boolean;
  source: 'addon' | 'alpha' | 'trial' | null;
  tier: string | null;
  trial: { endsAt: string; daysLeft: number } | null;
  trialAvailable: boolean;
  /** Teste de 7 dias já acabou e a conta não assinou — serviço bloqueado. */
  trialExpired?: boolean;
  /** Org tem Instagram conectado — libera o canal Instagram nas campanhas. */
  hasInstagram?: boolean;
}

interface Props {
  open: boolean;
  entitlement: ImpulsoEntitlement | null;
  onClose: () => void;
  /** Chamado após ativar o teste (a página refaz o fetch e libera). */
  onActivated: () => void;
}

const GRAD = 'bg-gradient-to-r from-[#2FB57A] via-[#2F7FB5] to-[#4A52D0]';

const PLANS = [
  {
    key: 'IMPULSO_START',
    name: 'Start',
    price: 197,
    who: 'Para começar a vender com a Iza.',
    features: ['Iza Estrategista + Studio', 'WhatsApp, e-mail e SMS', 'Até 5.000 contatos ativos', 'IA de campanha inclusa'],
    highlight: false,
  },
  {
    key: 'IMPULSO_PRO',
    name: 'Pro',
    price: 497,
    who: 'Quem quer o loop de anúncios fechado.',
    features: ['Tudo do Start', 'Anúncios Meta (CTWA, Lead Ads, CAPI)', 'Atribuição de receita + Pix no chat', 'Auto-otimização + TikTok', 'Até 25.000 contatos'],
    highlight: true,
  },
  {
    key: 'IMPULSO_SCALE',
    name: 'Scale',
    price: 997,
    who: 'Operação de performance com verba.',
    features: ['Tudo do Pro', 'Google Ads + conversões offline', 'Autopiloto + múltiplos números', 'Contatos ilimitados'],
    highlight: false,
  },
];

export function ImpulsoUpsellModal({ open, entitlement, onClose, onActivated }: Props) {
  const [activating, setActivating] = useState(false);
  const [contratando, setContratando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detailPlan, setDetailPlan] = useState<PlanKey | null>(null);

  if (!open) return null;

  const canTrial = entitlement?.trialAvailable ?? false;

  async function activateTrial() {
    setActivating(true);
    setError(null);
    try {
      await api.post('/api/impulso-access/trial');
      onActivated();
    } catch (err: any) {
      setError(err?.message || 'Não foi possível ativar o teste agora. Tente de novo.');
    } finally {
      setActivating(false);
    }
  }

  async function contratar(tier: string) {
    setError(null);
    setContratando(tier);
    try {
      const res = await api.post('/api/impulso-access/checkout', { tier });
      if (res.data?.url) {
        window.location.href = res.data.url; // vai pro checkout do Stripe
      } else {
        setError('Não foi possível iniciar a contratação. Tente de novo.');
        setContratando(null);
      }
    } catch (err: any) {
      setError(err?.message || 'Não foi possível iniciar a contratação.');
      setContratando(null);
    }
  }

  return (
    <>
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={`relative px-6 py-6 text-white ${GRAD}`}>
          <button onClick={onClose} className="absolute top-4 right-4 text-white/80 hover:text-white"><X size={18} /></button>
          <div className="flex items-center gap-2 text-white/90 text-xs font-semibold uppercase tracking-wide">
            <Sparkles size={14} /> ZappIQ Impulso
          </div>
          <h2 className="text-2xl font-bold mt-2">Transforme suas conversas em campanhas que vendem</h2>
          <p className="text-white/90 text-sm mt-1.5 max-w-xl">
            A Iza cria, dispara e acompanha suas campanhas de ponta a ponta. Ative e comece a vender de forma proativa hoje.
          </p>
        </div>

        {/* Trial CTA */}
        {canTrial && (
          <div className="px-6 py-4 bg-[#E4F3EC] border-b border-[#CDE9DA] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Rocket size={18} className="text-[#1B7A54]" />
              <div>
                <p className="text-sm font-semibold text-[#1B7A54]">Experimente 7 dias grátis</p>
                <p className="text-xs text-[#2f7a5a]">Acesso completo ao Impulso, sem cobrança. Cancele quando quiser.</p>
              </div>
            </div>
            <button
              onClick={activateTrial}
              disabled={activating}
              className={`inline-flex items-center gap-2 px-4 py-2 text-white rounded-lg text-sm font-semibold hover:opacity-95 disabled:opacity-50 whitespace-nowrap ${GRAD}`}
            >
              {activating ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
              {activating ? 'Ativando…' : 'Ativar teste grátis'} {!activating && <ArrowRight size={15} />}
            </button>
          </div>
        )}

        {/* Planos */}
        <div className="px-6 py-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Planos do Impulso</p>
          <div className="grid sm:grid-cols-3 gap-3">
            {PLANS.map((p) => (
              <div key={p.key} className={`rounded-xl border p-4 flex flex-col ${p.highlight ? 'border-transparent ring-2 ring-[#4A52D0]' : 'border-gray-200'}`}>
                {p.highlight && (
                  <span className={`self-start text-[10px] font-bold text-white px-2 py-0.5 rounded mb-1.5 ${GRAD}`}>MAIS VENDIDO</span>
                )}
                <h3 className="text-sm font-bold text-gray-900">{p.name}</h3>
                <div className="mt-1">
                  <span className="text-2xl font-bold text-gray-900">R$ {p.price}</span>
                  <span className="text-xs text-gray-400">/mês</span>
                </div>
                <p className="text-[11px] text-gray-500 mt-1 mb-3 min-h-[28px]">{p.who}</p>
                <ul className="space-y-1.5 flex-1">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-1.5 text-[11px] text-gray-600">
                      <Check size={12} className="text-[#2FB57A] flex-shrink-0 mt-0.5" /> {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => contratar(p.key)}
                  disabled={contratando !== null}
                  className={`mt-3 w-full py-2 rounded-lg text-xs font-semibold disabled:opacity-50 ${p.highlight ? `${GRAD} text-white hover:opacity-95` : 'border border-gray-200 text-gray-700 hover:bg-gray-50'}`}
                >
                  {contratando === p.key ? 'Redirecionando…' : 'Contratar'}
                </button>
                <button
                  onClick={() => setDetailPlan(p.key as PlanKey)}
                  className="mt-1.5 w-full py-1.5 rounded-lg text-[11px] font-semibold text-[#3A3FA8] hover:bg-[#F3F4FE] inline-flex items-center justify-center gap-1"
                >
                  <Info size={12} /> Saiba mais
                </button>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-gray-400 mt-3 text-center">
            Mensagens de marketing são cobradas por uso (custo do WhatsApp repassado). Sem taxa de setup. Cancele quando quiser.
          </p>
          {error && <p className="text-xs text-red-600 mt-2 text-center">{error}</p>}
        </div>
      </div>
    </div>
    <ImpulsoPlanDetailModal planKey={detailPlan} onClose={() => setDetailPlan(null)} />
    </>
  );
}
