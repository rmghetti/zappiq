'use client';

/* ══════════════════════════════════════════════════════════════════════
 * /admin/leads — Visibilidade total de signups + orgs novas
 * --------------------------------------------------------------------
 * Unifica signups (intenção) + organizations (cadastrados) + atividade
 * (mensagens IA). Status calculado:
 *   - signup_only  → registrou em /cadastro, não confirmou (sem org)
 *   - cadastrado   → tem org, 0 mensagens (parado!)
 *   - ativo        → tem org + uso real
 *
 * Filtro staging (default ON) esconde fixtures.
 * Restrito a SUPERADMIN.
 * ══════════════════════════════════════════════════════════════════════ */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users, Mail, AlertCircle, RefreshCw, Building2, TrendingUp,
  MessageCircle, AlertTriangle, CheckCircle2,
} from 'lucide-react';
import { useAuthStore } from '../../../../stores/authStore';
import { leadsApi, LeadsResponse, LeadRow } from '../../../../lib/adminApi';

const REFRESH_MS = 60_000;

export default function LeadsPage() {
  const router = useRouter();
  const { user } = useAuthStore();

  const [data, setData] = useState<LeadsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);

  useEffect(() => {
    if (user && user.role !== 'SUPERADMIN') router.push('/dashboard');
  }, [user, router]);

  useEffect(() => {
    if (user?.role !== 'SUPERADMIN') return;
    let mounted = true;
    const fetchData = async () => {
      try {
        const res = await leadsApi.getLeads({ days });
        if (mounted) { setData(res); setError(null); }
      } catch (err: any) {
        if (mounted) setError(err?.message || 'Erro ao buscar leads');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchData();
    const t = setInterval(fetchData, REFRESH_MS);
    return () => { mounted = false; clearInterval(t); };
  }, [user, days]);

  const manualRefresh = async () => {
    setLoading(true);
    try {
      const res = await leadsApi.getLeads({ days });
      setData(res); setError(null);
    } catch (err: any) {
      setError(err?.message || 'Erro');
    } finally {
      setLoading(false);
    }
  };

  if (user?.role !== 'SUPERADMIN') return null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="text-primary-500" size={26} />
            Leads & Signups
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Visibilidade total · signups (intenção) + organizations (cadastrados) + atividade real
            {data?.summary.stagingFilteredCount ? (
              <span className="ml-2 inline-flex items-center text-[10px] font-semibold bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                {data.summary.stagingFilteredCount} staging ocultas
              </span>
            ) : null}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
          >
            <option value={7}>Últimos 7 dias</option>
            <option value={14}>Últimos 14 dias</option>
            <option value={30}>Últimos 30 dias</option>
            <option value={90}>Últimos 90 dias</option>
          </select>
          <button
            onClick={manualRefresh}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm font-semibold text-red-900">{error}</p>
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <SummaryCard icon={<Users size={16} />} label="Total Leads" value={data.summary.totalLeads} color="blue" />
            <SummaryCard icon={<Mail size={16} />} label="Signup only" value={data.summary.signupOnly} color="amber" hint="não confirmou" />
            <SummaryCard icon={<Building2 size={16} />} label="Cadastrado parado" value={data.summary.cadastrado} color="orange" hint="0 msgs IA" />
            <SummaryCard icon={<TrendingUp size={16} />} label="Ativo" value={data.summary.ativo} color="green" hint="usando IA" />
          </div>

          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">
                {data.rows.length} leads nos últimos {data.summary.periodDays} dias
              </h3>
              <span className="text-xs text-gray-400">Refresh auto 60s</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-500">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-semibold">Lead</th>
                    <th className="px-4 py-2.5 text-left font-semibold">Plano</th>
                    <th className="px-4 py-2.5 text-center font-semibold">Status</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Atividade</th>
                    <th className="px-4 py-2.5 text-left font-semibold">UTM</th>
                    <th className="px-4 py-2.5 text-left font-semibold">Cadastrado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.rows.map((row) => <LeadRowComp key={`${row.kind}-${row.id}`} row={row} />)}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SummaryCard({ icon, label, value, hint, color }: { icon: React.ReactNode; label: string; value: number; hint?: string; color: 'blue' | 'amber' | 'orange' | 'green' }) {
  const bgMap: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-100 text-blue-700',
    amber: 'bg-amber-50 border-amber-100 text-amber-700',
    orange: 'bg-orange-50 border-orange-100 text-orange-700',
    green: 'bg-green-50 border-green-100 text-green-700',
  };
  return (
    <div className={`rounded-lg border p-3 ${bgMap[color]}`}>
      <div className="flex items-center gap-1.5 mb-1">{icon}<p className="text-[10px] font-semibold uppercase tracking-wider">{label}</p></div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {hint && <p className="text-[10px] text-gray-500 mt-0.5">{hint}</p>}
    </div>
  );
}

function LeadRowComp({ row }: { row: LeadRow }) {
  const statusBadge = renderStatusBadge(row.status);
  const utm = row.utmSource ? `${row.utmSource}${row.utmMedium ? '/' + row.utmMedium : ''}${row.utmCampaign ? '/' + row.utmCampaign : ''}` : '—';

  return (
    <tr className={row.status === 'cadastrado' ? 'bg-orange-50' : row.status === 'signup_only' ? 'bg-amber-50' : ''}>
      <td className="px-4 py-3">
        <div className="flex flex-col">
          <span className="font-semibold text-gray-900 text-[13px]">{row.name}</span>
          {row.ownerEmail ? (
            <span className="text-[11px] text-gray-500">
              {row.ownerName || '—'} ·{' '}
              <a href={`mailto:${row.ownerEmail}`} className="text-primary-600 hover:underline">
                {row.ownerEmail}
              </a>
            </span>
          ) : null}
          {row.company && <span className="text-[10px] text-gray-400">Empresa: {row.company}</span>}
          {row.cnpj && <span className="text-[10px] text-gray-400">CNPJ: {row.cnpj}</span>}
        </div>
      </td>
      <td className="px-4 py-3">
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-700 bg-gray-100 px-2 py-0.5 rounded">{row.plan}</span>
        {row.isTrialActive && <span className="ml-1 inline-flex items-center text-[9px] font-bold text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded">TRIAL</span>}
      </td>
      <td className="px-4 py-3 text-center">{statusBadge}</td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-2 text-[12px] text-gray-700">
          <MessageCircle size={12} className="text-gray-400" />
          {row.messagesCount} msgs / {row.conversationsCount} conv
        </div>
      </td>
      <td className="px-4 py-3 text-[11px] text-gray-500 font-mono">{utm}</td>
      <td className="px-4 py-3 text-[11px] text-gray-500 font-mono">
        {new Date(row.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
      </td>
    </tr>
  );
}

function renderStatusBadge(status: 'signup_only' | 'cadastrado' | 'ativo') {
  const map = {
    signup_only: { bg: 'bg-amber-100 text-amber-800', icon: <Mail size={10} />, label: 'Signup only' },
    cadastrado: { bg: 'bg-orange-100 text-orange-800', icon: <AlertTriangle size={10} />, label: 'Cadastrado parado' },
    ativo: { bg: 'bg-green-100 text-green-800', icon: <CheckCircle2 size={10} />, label: 'Ativo' },
  };
  const cfg = map[status];
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full ${cfg.bg}`}>
      {cfg.icon} {cfg.label}
    </span>
  );
}
