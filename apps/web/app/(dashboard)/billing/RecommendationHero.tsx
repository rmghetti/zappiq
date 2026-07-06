'use client';

import { useEffect, useState } from 'react';
import { Sparkles, Check, ArrowRight, Star } from 'lucide-react';
import { api } from '../../../lib/api';
import type { PaywallMode } from '../../../stores/authStore';

type BillingCycle = 'monthly' | 'annual';

interface AddonSuggestion {
  dimension: string;
  label: string;
}
interface Recommendation {
  planId: 'IZA_LITE' | 'GROWTH' | 'SCALE';
  planLabel: string;
  cycle: 'annual';
  monthlyBrl: number;
  annualMonthlyBrl: number;
  annualSavingsBrl: number;
  reasons: string[];
  addonSuggestions: AddonSuggestion[];
}

function brl(v: number): string {
  return `R$ ${v.toLocaleString('pt-BR')}`;
}

/**
 * Hero de conversão no topo de /billing. Aparece quando o trial venceu (paywall
 * soft/hard) ou quando a pessoa chega por um link de "trial acabando". Mostra o
 * plano recomendado pelo uso, com o anual em destaque, razões e addons sugeridos.
 */
export function RecommendationHero({
  paywall,
  onChoose,
  loadingPlan,
}: {
  paywall?: PaywallMode;
  onChoose: (planId: string, cycle: BillingCycle) => void;
  loadingPlan: string | null;
}) {
  const [reason, setReason] = useState<string | null>(null);
  const [rec, setRec] = useState<Recommendation | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setReason(new URLSearchParams(window.location.search).get('reason'));
    }
  }, []);

  const hardOrSoft = paywall === 'hard' || paywall === 'soft';
  const fromTrialLink = !!reason && reason.startsWith('trial');
  const show = hardOrSoft || fromTrialLink;

  useEffect(() => {
    if (!show) return;
    let active = true;
    (async () => {
      try {
        const res = await api.get('/api/billing/recommendation');
        if (active && res?.data) setRec(res.data as Recommendation);
      } catch {
        // fail-soft: sem recomendação, o hero ainda mostra a mensagem + cards abaixo
      }
    })();
    return () => {
      active = false;
    };
  }, [show]);

  if (!show) return null;

  const headline =
    paywall === 'hard' || reason === 'trial_expired'
      ? 'Seu teste terminou. Escolha um plano para continuar.'
      : 'Seu teste está acabando. Garanta seu plano sem interrupção.';

  return (
    <div className="mb-6 rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-fuchsia-50 p-6">
      <div className="flex items-center gap-2 text-violet-700">
        <Sparkles size={18} />
        <span className="text-xs font-bold uppercase tracking-wide">Recomendado pra você</span>
      </div>
      <h2 className="mt-2 text-xl font-extrabold text-gray-900">{headline}</h2>

      {rec ? (
        <div className="mt-4 grid gap-4 md:grid-cols-[1.2fr_1fr]">
          {/* Card do plano recomendado */}
          <div className="rounded-xl border-2 border-violet-300 bg-white p-5">
            <div className="flex items-center gap-2">
              <Star size={16} className="text-violet-600" fill="currentColor" />
              <span className="text-sm font-bold text-violet-700">Plano {rec.planLabel}</span>
              <span className="ml-auto text-[10px] font-bold uppercase text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                Anual -20%
              </span>
            </div>
            <div className="mt-3 flex items-end gap-2">
              <span className="text-3xl font-black text-gray-900">{brl(rec.annualMonthlyBrl)}</span>
              <span className="mb-1 text-sm text-gray-500">/mês no anual</span>
            </div>
            <p className="text-xs text-emerald-700 font-semibold">
              Você economiza {brl(rec.annualSavingsBrl)} no primeiro ano.
            </p>
            <ul className="mt-3 space-y-1.5">
              {rec.reasons.map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                  <Check size={14} className="mt-0.5 text-violet-500 flex-shrink-0" />
                  <span>{r}</span>
                </li>
              ))}
            </ul>
            <button
              onClick={() => onChoose(rec.planId, 'annual')}
              disabled={loadingPlan === rec.planId}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-3 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-60"
            >
              {loadingPlan === rec.planId ? 'Redirecionando...' : `Assinar ${rec.planLabel} anual`}
              <ArrowRight size={16} />
            </button>
          </div>

          {/* Addons sugeridos */}
          <div className="rounded-xl border border-gray-200 bg-white/60 p-5">
            <p className="text-sm font-bold text-gray-800">Serviços extras que combinam com seu uso</p>
            {rec.addonSuggestions.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {rec.addonSuggestions.map((a) => (
                  <li key={a.dimension} className="flex items-center gap-2 text-sm text-gray-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-fuchsia-400" />
                    {a.label}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-xs text-gray-500">
                Seu uso cabe no plano recomendado. Você pode adicionar pacotes extras depois, quando precisar.
              </p>
            )}
            <p className="mt-4 text-xs text-gray-400">
              Os planos completos estão logo abaixo, caso queira comparar.
            </p>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-sm text-gray-600">
          Escolha um dos planos abaixo. No anual você economiza 20%.
        </p>
      )}
    </div>
  );
}
