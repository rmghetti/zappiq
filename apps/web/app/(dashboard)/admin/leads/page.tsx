'use client';

/* ══════════════════════════════════════════════════════════════════════
 * /admin/leads → /admin/clientes/leads (Área Clientes / Fase 2, §2/§6).
 * --------------------------------------------------------------------
 * A antiga tela de leads foi absorvida pela Área Clientes. Redirect client-side
 * para a nova rota, que traz a taxonomia NOVO/EM_TRIAL/ATIVO/TRIAL_EXPIRADO/
 * PAGO/CHURNED. Usa replace() para não poluir o histórico.
 * ══════════════════════════════════════════════════════════════════════ */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LeadsRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/admin/clientes/leads');
  }, [router]);

  return (
    <div className="flex items-center justify-center h-64 text-gray-500 text-sm">
      Redirecionando para Clientes → Leads & Signups...
    </div>
  );
}
