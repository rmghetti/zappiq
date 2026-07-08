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
 * soft/hard), quando a pessoa chega por um link de "trial acabando" OU durante o
 * trial ativo (pra assinar o plano já escolhido antes do fim, sem fricção).
 * Mostra o plano recomendado pelo uso, com o anual em destaque, razões e addons.
 */
interface PurchasableAddon {
  key: string;
  name: string;
  amountBrl: number;
}

export function RecommendationHero({
  paywall,
  trialActive,
  trialDaysLeft,
  onChoose,
  loadingPlan,
}: {
  paywall?: PaywallMode;
  /** Trial em andamento (lifecycleStage TRIAL) — hero de conversão antecipada. */
  trialActive?: boolean;
  trialDaysLeft?: number | null;
  onChoose: (planId: string, cycle: BillingCycle, addons?: string[]) => void;
  loadingPlan: string | null;
}) {
  const [reason, setReason] = useState<string | null>(null);
  const [rec, setRec] = useState<Recommendation | null>(null);
  const [addons, setAddons] = useState<PurchasableAddon[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggleAddon(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setReason(new URLSearchParams(window.location.search).get('reason'));
    }
  }, []);

  const hardOrSoft = paywall === 'hard' || paywall === 'soft';
  const fromTrialLink = !!reason && reason.startsWith('trial');
  const show = hardOrSoft || fromTrialLink || !!trialActive;

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

  useEffect(() => {
    if (!show) return;
    let active = true;
    (async () => {
      try {
        const res = await api.get('/api/billing/addons');
        if (active && res?.data) setAddons(res.data as PurchasableAddon[]);
      } catch {
        // fail-soft: sem catálogo de addons, o pacote sai só com o plano
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
      : hardOrSoft
      ? 'Seu teste está acabando. Garanta seu plano sem interrupção.'
      : trialDaysLeft != null && trialDaysLeft > 0
      ? `Seu teste segue ativo por mais ${trialDaysLeft} ${trialDaysLeft === 1 ? 'dia' : 'dias'}. Assine agora e continue sem interrupção.`
      : 'Assine agora o plano que você está testando e continue sem interrupção.';

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
              onClick={() => onChoose(rec.planId, 'annual', Array.from(selected))}
              disabled={loadingPlan === rec.planId}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-3 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-60"
            >
              {loadingPlan === rec.planId
                ? 'Redirecionando...'
                : `Assinar ${rec.planLabel} anual${selected.size ? ` + ${selected.size} addon${selected.size > 1 ? 's' : ''}` : ''}`}
              <ArrowRight size={16} />
            </button>
          </div>

          {/* Addons compráveis no pacote (recorrentes, entram na mesma assinatura) */}
          <div className="rounded-xl border border-gray-200 bg-white/60 p-5">
            <p className="text-sm font-bold text-gray-800">Adicione serviços extras ao pacote</p>
            {rec.addonSuggestions.length > 0 && (
              <p className="mt-1 text-xs text-fuchsia-600">
                Pelo seu uso, vale olhar: {rec.addonSuggestions.map((a) => a.label).join(', ')}.
              </p>
            )}
            {addons.length > 0 ? (
              <div className="mt-3 space-y-1.5">
                {addons.map((a) => (
                  <label
                    key={a.key}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(a.key)}
                      onChange={() => toggleAddon(a.key)}
                      className="h-4 w-4 rounded border-gray-300 text-violet-600"
                    />
                    <span className="flex-1 text-sm text-gray-700">{a.name}</span>
                    <span className="text-xs font-semibold text-gray-500">{brl(a.amountBrl)}/mês</span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-xs text-gray-500">
                Você pode adicionar pacotes extras depois, quando precisar.
              </p>
            )}
            <p className="mt-4 text-xs text-gray-400">
              Os addons marcados entram junto na sua assinatura. Os planos completos estão logo abaixo.
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
