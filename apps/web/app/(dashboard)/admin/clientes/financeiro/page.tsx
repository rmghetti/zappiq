'use client';

/* ══════════════════════════════════════════════════════════════════════
 * /admin/clientes/financeiro — Financeiro (Área Clientes / Fase 2, §5).
 * --------------------------------------------------------------------
 * Esqueleto HONESTO: banner de saúde de dados no topo (não induzir decisão
 * com número inflado). MRR real (R$0 honesto) + custo/margem reais que já
 * existem. MRR bridge / NRR / GRR / dunning ficam para a Fase 3.
 *
 * Guard de role repetido.
 * ══════════════════════════════════════════════════════════════════════ */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DollarSign, AlertCircle, Info, TrendingUp, Zap } from 'lucide-react';
import { useAuthStore } from '../../../../../stores/authStore';
import { MetricCard } from '../../unit-economics/MetricCard';
import { clientesApi, ClientesFinanceiroSummary } from '../../../../../lib/adminApi';

export default function ClientesFinanceiroPage() {
  const router = useRouter();
  const { user } = useAuthStore();

  const [data, setData] = useState<ClientesFinanceiroSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user && user.role !== 'SUPERADMIN') router.push('/dashboard');
  }, [user, router]);

  useEffect(() => {
    if (user?.role !== 'SUPERADMIN') return;
    let mounted = true;
    (async () => {
      try {
        const res = await clientesApi.getFinanceiroSummary();
        if (mounted) { setData(res); setError(null); }
      } catch (err: any) {
        if (mounted) setError(err?.message || 'Erro ao buscar financeiro');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [user]);

  if (user?.role !== 'SUPERADMIN') return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <DollarSign className="text-primary-500" size={26} />
          Financeiro
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          MRR real e transparente · custo/margem reais · faturamento entra na Fase 3
        </p>
      </div>

      {/* Banner de saúde de dados (§5) */}
      {data && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
          <Info size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-900">
            <p className="font-semibold">Saúde dos dados financeiros</p>
            <p className="mt-0.5">
              {data.dataHealth.note ??
                `${data.dataHealth.payingAccounts} conta(s) pagante(s) real(is). Números de billing refletem apenas assinaturas Stripe ativas.`}
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm font-semibold text-red-900">{error}</p>
        </div>
      )}

      {/* Agregados REAIS que já existem */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="MRR real"
          value={loading || !data ? '—' : `R$ ${data.real.mrrRealBrl.toFixed(2)}`}
          icon={DollarSign}
          loading={loading}
        />
        <MetricCard label="Contas pagantes" value={data?.real.payingAccounts ?? '—'} icon={TrendingUp} loading={loading} />
        <MetricCard
          label="Custo LLM (USD)"
          value={loading || !data ? '—' : `$${data.real.llmCostUsd.toFixed(2)}`}
          icon={Zap}
          loading={loading}
        />
        <MetricCard
          label="Receita reconhecida (BRL)"
          value={loading || !data ? '—' : `R$ ${data.real.recognizedRevenueBrl.toFixed(2)}`}
          loading={loading}
        />
      </div>

      {/* Tenants lucrativos vs deficitários (excluindo staging) */}
      {data && (
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Margem por tenant (real, sem staging)</h3>
          <div className="flex gap-6 text-sm">
            <div>
              <p className="text-2xl font-bold text-green-600">{data.real.profitableTenants}</p>
              <p className="text-xs text-gray-500">lucrativos</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">{data.real.deficitTenants}</p>
              <p className="text-xs text-gray-500">deficitários</p>
            </div>
          </div>
        </div>
      )}

      {/* Métricas pendentes (Fase 3) — mostradas como placeholder honesto */}
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Chega na Fase 3 (Financeiro completo)</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          {['MRR bridge (New/Expansion/Contraction/Churn)', 'NRR / GRR', 'Churn logo vs receita', 'Receita recuperada por dunning'].map((label) => (
            <div key={label} className="bg-white rounded-lg border border-gray-100 p-3">
              <p className="text-xs text-gray-500">{label}</p>
              <p className="text-lg font-bold text-gray-300 mt-1">em breve</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-3">
          Requer a reescrita do stripeWebhook + tabela de invoices (Fase 3). Não exibimos número estimado para não induzir decisão.
        </p>
      </div>
    </div>
  );
}
