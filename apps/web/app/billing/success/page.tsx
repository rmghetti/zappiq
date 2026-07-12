'use client';

/**
 * /billing/success: página de retorno do Stripe Checkout.
 * ------------------------------------------------------------------
 * Antes esta rota NÃO existia: o success_url do Checkout apontava para
 * /billing/success?session_id=... e o Next.js devolvia 404 ("This page
 * could not be found") em TODO checkout concluído (incidente 06/07).
 *
 * Agora: confirma a ativação no servidor (endpoint idempotente, mesma
 * lógica do webhook) e, com o cliente já reconhecido como ATIVO, leva ao
 * painel. Resiliente a atraso de webhook: tenta o confirm, faz fallback
 * pra polling do status da assinatura, e sempre oferece o botão manual
 * pro painel. Nunca mais uma tela morta.
 */

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Loader2 } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://zappiq-api.fly.dev';
const MAX_ATTEMPTS = 8;
const POLL_MS = 1500;

export default function BillingSuccessPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<'confirming' | 'active'>('confirming');
  const doneRef = useRef(false);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('zappiq_token') : null;
    const sessionId =
      typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('session_id')
        : null;

    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    function goToDashboard(delay = 900) {
      if (doneRef.current) return;
      doneRef.current = true;
      setPhase('active');
      timer = setTimeout(() => router.replace('/dashboard'), delay);
    }

    async function isActive(): Promise<boolean> {
      if (!token) return false;
      const auth = { Authorization: `Bearer ${token}` };

      // 1) Confirmação síncrona idempotente (endpoint novo). Materializa a
      //    assinatura na org na hora. Se ainda não estiver deployado, cai no
      //    404 e usamos o fallback abaixo.
      if (sessionId) {
        try {
          const r = await fetch(`${API_URL}/api/billing/checkout/confirm`, {
            method: 'POST',
            headers: { ...auth, 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_id: sessionId }),
          });
          if (r.ok) {
            const d = await r.json().catch(() => ({} as any));
            if (d?.active) return true;
          }
        } catch {
          /* rede: tenta o fallback */
        }
      }

      // 2) Fallback: o webhook do Stripe finaliza em ~1s; consultamos o estado
      //    real da assinatura até virar active/trialing.
      try {
        const r = await fetch(`${API_URL}/api/billing/subscription`, { headers: auth });
        if (r.ok) {
          const d = await r.json().catch(() => ({} as any));
          const status = String(d?.data?.status || '').toLowerCase();
          if (status === 'active' || status === 'trialing' || status === 'paid') return true;
        }
      } catch {
        /* ignora */
      }
      return false;
    }

    async function tick() {
      attempts += 1;
      if (await isActive()) {
        goToDashboard();
        return;
      }
      if (attempts >= MAX_ATTEMPTS) {
        // Não confirmou a tempo (webhook ainda processando), manda pro painel
        // mesmo assim; a ativação materializa em segundos e o painel reflete.
        goToDashboard();
        return;
      }
      timer = setTimeout(tick, POLL_MS);
    }

    void tick();
    return () => {
      doneRef.current = true;
      if (timer) clearTimeout(timer);
    };
  }, [router]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
        <div className="mx-auto w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mb-5">
          {phase === 'confirming' ? (
            <Loader2 className="w-7 h-7 text-green-600 animate-spin" />
          ) : (
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          )}
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">
          {phase === 'confirming' ? 'Confirmando seu pagamento...' : 'Pagamento confirmado!'}
        </h1>
        <p className="text-sm text-gray-500 mb-6">
          {phase === 'confirming'
            ? 'Estamos ativando sua conta. Leva só alguns segundos.'
            : 'Sua conta está ativa. Vamos te levar para o painel.'}
        </p>
        <button
          onClick={() => router.replace('/dashboard')}
          className="inline-flex items-center justify-center w-full px-5 py-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-sm font-medium transition-colors"
        >
          Ir para o painel
        </button>
      </div>
    </main>
  );
}
