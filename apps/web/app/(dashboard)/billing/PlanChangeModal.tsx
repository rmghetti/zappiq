'use client';

import { useEffect, useState } from 'react';
import { X, ArrowRight, CalendarClock, Zap, AlertTriangle } from 'lucide-react';
import { api } from '../../../lib/api';

type BillingCycle = 'monthly' | 'annual';

interface PreviewData {
  kind: 'noop' | 'upgrade' | 'downgrade' | 'downgrade_annual_locked' | 'contact_sales';
  effectiveTiming: 'immediate' | 'period_end' | 'renewal' | 'none';
  currentPlanLabel: string;
  targetPlanLabel: string;
  chargeNowBrlCents: number;
  effectiveDate: string | null;
  newRenewalDate: string | null;
}

function brl(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

/**
 * Modal de confirmação de troca de plano. Chama /change/preview pra mostrar a
 * conta (best practice anti-disputa) e /change pra aplicar. O tipo de troca
 * (upgrade imediato vs downgrade agendado) é decidido pelo servidor.
 */
export function PlanChangeModal({
  targetPlan,
  targetCycle,
  targetLabel,
  onClose,
  onApplied,
}: {
  targetPlan: string;
  targetCycle: BillingCycle;
  targetLabel: string;
  onClose: () => void;
  onApplied: (msg: string) => void;
}) {
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await api.post('/api/billing/change/preview', {
          plan: targetPlan,
          cycle: targetCycle,
        });
        if (active) setPreview(res?.data as PreviewData);
      } catch (err: any) {
        if (active) {
          // 409 no_active_subscription → orienta ao checkout (não deveria abrir aqui).
          setError(err?.message || 'Não consegui calcular a troca agora. Tente de novo.');
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [targetPlan, targetCycle]);

  async function handleConfirm() {
    setApplying(true);
    setError(null);
    try {
      const res = await api.post('/api/billing/change', { plan: targetPlan, cycle: targetCycle });
      const kind = res?.kind;
      if (kind === 'upgrade') {
        onApplied(`Upgrade para ${targetLabel} aplicado. O acesso já está liberado.`);
      } else {
        onApplied(
          `Troca para ${targetLabel} agendada para ${fmtDate(res?.effectiveAt ?? preview?.effectiveDate ?? null)}.`,
        );
      }
    } catch (err: any) {
      setError(err?.message || 'Não consegui aplicar a troca agora. Tente de novo.');
      setApplying(false);
    }
  }

  const isUpgrade = preview?.kind === 'upgrade';
  const isScheduled = preview?.kind === 'downgrade' || preview?.kind === 'downgrade_annual_locked';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <h3 className="text-lg font-bold text-gray-900">
            {isUpgrade ? 'Confirmar upgrade' : 'Confirmar troca de plano'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Fechar">
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <p className="py-8 text-center text-sm text-gray-400">Calculando os valores…</p>
        ) : error ? (
          <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-800">
            <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        ) : preview ? (
          <>
            <div className="mb-4 flex items-center gap-2 text-sm text-gray-600">
              <span className="font-semibold text-gray-900">{preview.currentPlanLabel}</span>
              <ArrowRight size={16} className="text-gray-400" />
              <span className="font-semibold text-primary-600">{preview.targetPlanLabel}</span>
            </div>

            {isUpgrade && (
              <div className="rounded-xl border border-primary-100 bg-primary-50/50 p-4">
                <div className="flex items-center gap-2 text-primary-700">
                  <Zap size={16} />
                  <span className="text-sm font-bold">Vale agora</span>
                </div>
                <p className="mt-2 text-sm text-gray-700">
                  Você paga hoje <span className="font-bold">{brl(preview.chargeNowBrlCents)}</span>{' '}
                  (proporcional aos dias restantes do ciclo). Depois,{' '}
                  a renovação segue em <span className="font-semibold">{fmtDate(preview.newRenewalDate)}</span>.
                </p>
              </div>
            )}

            {isScheduled && (
              <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-4">
                <div className="flex items-center gap-2 text-amber-700">
                  <CalendarClock size={16} />
                  <span className="text-sm font-bold">
                    {preview.kind === 'downgrade_annual_locked'
                      ? 'Vale na sua renovação'
                      : 'Vale na virada do ciclo'}
                  </span>
                </div>
                <p className="mt-2 text-sm text-gray-700">
                  Seu plano muda para <span className="font-semibold">{preview.targetPlanLabel}</span> em{' '}
                  <span className="font-bold">{fmtDate(preview.effectiveDate)}</span>. Até lá nada muda e
                  nada é cobrado. Você continua com tudo o que já pagou.
                </p>
              </div>
            )}

            <div className="mt-5 flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirm}
                disabled={applying}
                className="flex-1 rounded-lg bg-primary-500 py-2.5 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-60"
              >
                {applying ? 'Aplicando…' : isUpgrade ? 'Confirmar e pagar' : 'Confirmar agendamento'}
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
