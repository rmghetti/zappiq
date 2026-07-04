'use client';

/* ══════════════════════════════════════════════════════════════════════
 * /admin/clientes/financeiro — Financeiro (Área Clientes / Fase 3, §5).
 * --------------------------------------------------------------------
 * REAL e transparente (§10). MRR real (R$0 honesto hoje) é a métrica primária.
 * "Receita potencial (catálogo)" aparece rotulada como ESTIMATIVA, nunca como
 * MRR de board. Custo LLM e margem são reais (SUM llm_call_logs, Fase 0),
 * excluindo staging. NRR/GRR/MRR bridge/dunning: computados dos dados reais,
 * mostrados como "aguardando base pagante" enquanto vazios.
 *
 * Banner de saúde de dados no topo enquanto não há pagante.
 * Guard de role repetido.
 * ══════════════════════════════════════════════════════════════════════ */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DollarSign, AlertCircle, Info, TrendingUp, Zap, ShieldAlert, RotateCcw, type LucideIcon } from 'lucide-react';
import { useAuthStore } from '../../../../../stores/authStore';
import { MetricCard } from '../../unit-economics/MetricCard';
import { clientesApi, ClientesFinanceiroSummary } from '../../../../../lib/adminApi';

function brl(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

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

  const hasBaseline = data?.pending.hasPayingBaseline ?? false;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <DollarSign className="text-primary-500" size={26} />
          Financeiro
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          MRR real e transparente · custo/margem reais · receita potencial rotulada como estimativa
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

      {/* MÉTRICA PRIMÁRIA: MRR real (R$0 honesto hoje) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="MRR real"
          value={loading || !data ? '—' : brl(data.real.mrrRealBrl)}
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
          value={loading || !data ? '—' : brl(data.real.recognizedRevenueBrl)}
          loading={loading}
        />
      </div>

      {/* Receita potencial (catálogo) — ESTIMATIVA rotulada, nunca MRR de board */}
      {data && (
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-400 font-semibold">Receita potencial (catálogo)</p>
              <p className="text-2xl font-bold text-gray-400 mt-1">{brl(data.potential.catalogMrrBrl)}</p>
            </div>
            <span className="text-[11px] font-semibold bg-gray-100 text-gray-500 rounded-full px-2 py-1 whitespace-nowrap">
              estimativa
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-2">{data.potential.label}</p>
        </div>
      )}

      {/* Faturas Stripe pagas de fato (Fase 3) + margem por tenant (real) */}
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Faturas Stripe pagas (período)</h3>
            <div className="flex gap-6 text-sm">
              <div>
                <p className="text-2xl font-bold text-gray-900">{brl(data.real.recognizedInvoiceBrl)}</p>
                <p className="text-xs text-gray-500">reconhecido em faturas</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{data.real.paidInvoicesCount}</p>
                <p className="text-xs text-gray-500">faturas pagas</p>
              </div>
            </div>
            {data.real.paidInvoicesCount === 0 && (
              <p className="text-xs text-gray-400 mt-2">Sem faturas pagas ainda — entra automaticamente quando o Stripe confirmar o 1º pagamento.</p>
            )}
          </div>

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
        </div>
      )}

      {/* Retenção & risco — REAL, honesto: mostra "aguardando base pagante" quando vazio */}
      {data && (
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">Retenção & risco de receita</h3>
            {!hasBaseline && (
              <span className="text-[11px] font-semibold bg-amber-50 text-amber-700 rounded-full px-2 py-1">
                aguardando base pagante
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <RetentionStat label="NRR" value={data.pending.nrr != null ? `${data.pending.nrr}%` : null} />
            <RetentionStat label="GRR" value={data.pending.grr != null ? `${data.pending.grr}%` : null} />
            <RetentionStat
              label="MRR em risco (past due)"
              value={brl(data.pending.mrrAtRiskBrl)}
              sub={`${data.pending.pastDueAccounts} conta(s)`}
              icon={ShieldAlert}
              real
            />
            <RetentionStat
              label="Recuperado por dunning"
              value={brl(data.pending.recoveredByDunningBrl)}
              icon={RotateCcw}
              real
            />
          </div>
          {data.pending.note && (
            <p className="text-xs text-gray-400 mt-3">{data.pending.note}</p>
          )}
          <p className="text-xs text-gray-400 mt-1">
            Churn acumulado: <span className="font-semibold text-gray-500">{data.pending.churnedAccounts}</span> conta(s).
            NRR/GRR e MRR bridge exigem 2 períodos com base pagante para serem verdadeiros — por isso ficam vazios até lá,
            em vez de exibirmos um número que induza decisão.
          </p>
        </div>
      )}
    </div>
  );
}

function RetentionStat({
  label,
  value,
  sub,
  icon: Icon,
  real,
}: {
  label: string;
  value: string | null;
  sub?: string;
  icon?: LucideIcon;
  real?: boolean;
}) {
  return (
    <div className="bg-gray-50 rounded-lg border border-gray-100 p-3">
      <p className="text-xs text-gray-500 flex items-center gap-1">
        {Icon && <Icon size={12} className="text-gray-400" />}
        {label}
      </p>
      {value == null ? (
        <p className="text-sm font-semibold text-gray-300 mt-1">aguardando base</p>
      ) : (
        <p className={`text-lg font-bold mt-1 ${real ? 'text-gray-900' : 'text-gray-400'}`}>{value}</p>
      )}
      {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}
