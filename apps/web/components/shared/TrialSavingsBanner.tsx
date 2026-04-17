'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Clock, Zap, ArrowRight, X } from 'lucide-react';
import { api } from '../../lib/api';
import { SavingsCalculator } from './SavingsCalculator';

/* ═══════════════════════════════════════════════════════════════════════
 * TrialSavingsBanner
 * ---------------------------------------------------------------------
 * Card persistente na dashboard home que, durante o trial:
 *   1. Mostra a contagem regressiva do trial (14 dias → 0).
 *   2. Incentiva o usuário a refinar a cotação do concorrente em um
 *      mini-calculator (reusa SavingsCalculator, variant="dashboard").
 *   3. Oferece CTA direto para /billing para antecipar a conversão.
 *
 * Some após a conversão (isTrialActive=false && trialConverted=true) ou
 * quando o usuário fecha manualmente (persistido em localStorage).
 * ═══════════════════════════════════════════════════════════════════════ */

interface TrialInfo {
  isTrialActive: boolean;
  trialConverted: boolean;
  trialEndsAt: string | null;
  plan: string;
}

const DISMISS_KEY = 'zappiq_savings_banner_dismissed_at';
const DISMISS_TTL_HOURS = 48; // reaparece depois de 2 dias

function shouldHonorDismiss() {
  if (typeof window === 'undefined') return false;
  const ts = localStorage.getItem(DISMISS_KEY);
  if (!ts) return false;
  const dismissedAt = new Date(ts).getTime();
  const hoursAgo = (Date.now() - dismissedAt) / (1000 * 60 * 60);
  return hoursAgo < DISMISS_TTL_HOURS;
}

export function TrialSavingsBanner() {
  const [trial, setTrial] = useState<TrialInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (shouldHonorDismiss()) {
      setDismissed(true);
      return;
    }
    api
      .get('/api/auth/me')
      .then((res: any) => {
        const org = res.organization ?? res.data?.organization;
        if (!org) return;
        setTrial({
          isTrialActive: !!org.isTrialActive,
          trialConverted: !!org.trialConverted,
          trialEndsAt: org.trialEndsAt ?? null,
          plan: org.plan ?? 'TRIAL',
        });
      })
      .catch(() => setTrial(null));
  }, []);

  if (dismissed) return null;
  if (!trial) return null;
  if (!trial.isTrialActive || trial.trialConverted) return null;

  const daysRemaining = trial.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(trial.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 21;

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, new Date().toISOString());
    setDismissed(true);
  };

  return (
    <div className="relative bg-gradient-to-r from-primary-600 via-purple-600 to-primary-500 rounded-2xl overflow-hidden mb-6 shadow-lg">
      {/* Dismiss */}
      <button
        onClick={handleDismiss}
        aria-label="Fechar banner"
        className="absolute top-3 right-3 text-white/60 hover:text-white z-10 p-1.5 rounded-lg hover:bg-white/10 transition-colors"
      >
        <X size={16} />
      </button>

      <div className="p-6 md:p-7">
        <div className="flex items-start gap-4 flex-wrap md:flex-nowrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-white/80 text-xs font-bold uppercase tracking-wider mb-2">
              <Clock size={14} />
              Trial · {daysRemaining} {daysRemaining === 1 ? 'dia restante' : 'dias restantes'} · cap US$ 15
            </div>
            <h3 className="text-white font-display text-xl md:text-2xl font-extrabold leading-tight mb-1">
              {daysRemaining > 10
                ? 'Zero setup fee. Você já começou a economizar.'
                : daysRemaining > 3
                ? 'O concorrente cobraria setup. Aqui você só paga se converter.'
                : 'Reta final do trial. Converta antes do vencimento e trave 14% off no 1º ano.'}
            </h3>
            <p className="text-white/80 text-sm">
              Calcule quanto você economiza em 1 ano vs. a cotação que recebeu dos concorrentes.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setExpanded((v) => !v)}
              className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 backdrop-blur text-white font-semibold px-4 py-2.5 rounded-lg text-sm transition-colors"
            >
              {expanded ? 'Ocultar' : 'Calcular agora'} <Zap size={14} />
            </button>
            <Link
              href="/billing"
              className="inline-flex items-center gap-2 bg-white hover:bg-gray-50 text-primary-700 font-semibold px-4 py-2.5 rounded-lg text-sm transition-colors shadow-sm"
            >
              Converter trial <ArrowRight size={14} />
            </Link>
          </div>
        </div>

        {expanded && (
          <div className="mt-6">
            <SavingsCalculator
              variant="dashboard"
              showCta
              ctaHref="/billing"
              ctaLabel="Converter trial agora"
              zappiqTierLabel={trial.plan === 'TRIAL' ? 'ZappIQ Starter' : `ZappIQ ${trial.plan}`}
              subtitle="Ajuste os valores com o que você cotou — a economia é sua desde o dia 1."
            />
          </div>
        )}
      </div>
    </div>
  );
}
