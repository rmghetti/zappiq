'use client';

/**
 * /billing/cancel: retorno quando o cliente desiste no Stripe Checkout.
 * ------------------------------------------------------------------
 * Antes esta rota NÃO existia (cancel_url apontava pra cá) → 404. Agora
 * volta pros planos sem tela morta e deixa claro que nada foi cobrado.
 */

import { useRouter } from 'next/navigation';
import { XCircle } from 'lucide-react';

export default function BillingCancelPage() {
  const router = useRouter();
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
        <div className="mx-auto w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-5">
          <XCircle className="w-8 h-8 text-gray-400" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Pagamento não concluído</h1>
        <p className="text-sm text-gray-500 mb-6">
          Você voltou sem finalizar a assinatura e nenhuma cobrança foi feita.
          Quando quiser, é só escolher seu plano de novo.
        </p>
        <button
          onClick={() => router.replace('/billing')}
          className="inline-flex items-center justify-center w-full px-5 py-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-sm font-medium transition-colors"
        >
          Voltar para os planos
        </button>
      </div>
    </main>
  );
}
