'use client';

/**
 * /crm/atribuição — Atribuição campanha → venda (CRM Onda 4, PR #221)
 *
 * Mostra o funil fim-a-fim de cada campanha:
 *   sent → reply → contact → deal → won → receita
 *
 * KPIs agregados no topo (receita atribuída, deals atribuídos, ROI geral,
 * melhor campanha). Tabela detalhada por campanha. Tudo de
 * /api/crm/attribution.
 *
 * CAC = sentCount × R$ 0,05 (proxy Cloud API). Quando Campaign.budgetCents
 * existir, backend troca por spend real e UI continua igual.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, TrendingUp, DollarSign, Target, Trophy, MessageCircle } from 'lucide-react';
import { api } from '../../../../lib/api';

interface Campanha {
  id: string;
  name: string;
  type: string;
  status: string;
  createdAt: string;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  repliedCount: number;
  contactsCreated: number;
  dealsCreated: number;
  dealsWon: number;
  receitaTotal: number;
  ticketMedio: number;
  cacEstimado: number;
  roi: number;
  replyRate: number;
  conversionRate: number;
}

interface AttributionData {
  windowDays: number;
  kpisGerais: {
    totalReceitaAtribuida: number;
    totalDealsAtribuidos: number;
    totalCacEstimado: number;
    roiGeral: number;
    replyRateMedio: number;
    melhorCampanha: { id: string; name: string; roi: number } | null;
    totalCampanhas: number;
  };
  campanhas: Campanha[];
  assumptions: { costPerMessageBrl: number; note: string };
}

function fmtBRL(n: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n || 0);
}

function fmtPct(n: number, digits = 0): string {
  return `${(n * 100).toFixed(digits)}%`;
}

function fmtRoi(roi: number): string {
  if (!isFinite(roi)) return '∞';
  const sign = roi >= 0 ? '+' : '';
  return `${sign}${(roi * 100).toFixed(0)}%`;
}

function roiColor(roi: number): string {
  if (roi >= 2) return 'text-green-700 bg-green-50';
  if (roi >= 0.5) return 'text-emerald-700 bg-emerald-50';
  if (roi >= 0) return 'text-amber-700 bg-amber-50';
  return 'text-red-700 bg-red-50';
}

export default function CrmAttributionPage() {
  const [data, setData] = useState<AttributionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'roi' | 'receita' | 'recent'>('roi');

  useEffect(() => {
    setLoading(true);
    api
      .get<AttributionData>('/api/crm/attribution')
      .then((res) => setData(res))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-8 text-gray-500 text-sm">Carregando atribuição…</div>
    );
  }

  if (!data || data.campanhas.length === 0) {
    return (
      <div>
        <div className="flex items-center gap-3 mb-6">
          <Link href="/crm" className="text-gray-400 hover:text-gray-600">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Atribuição de campanhas</h1>
            <p className="text-sm text-gray-500 mt-1">Funil campanha → venda · últimos {data?.windowDays || 90} dias</p>
          </div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center">
          <Target size={32} className="mx-auto text-amber-700 mb-2" />
          <h3 className="text-sm font-semibold text-amber-900">Sem campanhas atribuídas ainda</h3>
          <p className="text-xs text-amber-800 mt-1 max-w-md mx-auto">
            Crie uma campanha em <Link href="/campanhas" className="underline font-medium">Campanhas</Link>, atribua leads
            e deals à campanha de origem, e os dados de ROI aparecerão aqui.
          </p>
        </div>
      </div>
    );
  }

  const k = data.kpisGerais;
  const campanhasOrdenadas = [...data.campanhas].sort((a, b) => {
    if (sortBy === 'roi') return b.roi - a.roi;
    if (sortBy === 'receita') return b.receitaTotal - a.receitaTotal;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/crm" className="text-gray-400 hover:text-gray-600" title="Voltar ao pipeline">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Atribuição de campanhas</h1>
            <p className="text-sm text-gray-500 mt-1">
              Funil campanha → venda · últimos {data.windowDays} dias · {k.totalCampanhas} campanha{k.totalCampanhas !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </div>

      {/* 4 KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <KpiBig
          label="Receita atribuída"
          value={fmtBRL(k.totalReceitaAtribuida)}
          sub={`${k.totalDealsAtribuidos} deals ganhos`}
          icon={<DollarSign size={16} />}
          tint="green"
        />
        <KpiBig
          label="ROI geral"
          value={fmtRoi(k.roiGeral)}
          sub={`CAC estimado: ${fmtBRL(k.totalCacEstimado)}`}
          icon={<TrendingUp size={16} />}
          tint={k.roiGeral >= 0 ? 'green' : 'red'}
        />
        <KpiBig
          label="Reply rate médio"
          value={fmtPct(k.replyRateMedio, 1)}
          sub="todas as campanhas"
          icon={<MessageCircle size={16} />}
          tint="blue"
        />
        <KpiBig
          label="Melhor ROI"
          value={k.melhorCampanha ? fmtRoi(k.melhorCampanha.roi) : '—'}
          sub={k.melhorCampanha?.name || 'Sem campanhas com gasto'}
          icon={<Trophy size={16} />}
          tint="purple"
        />
      </div>

      {/* Sort tabs */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs text-gray-500 font-medium">Ordenar por:</span>
        <SortBtn current={sortBy} value="roi" label="ROI" onClick={setSortBy} />
        <SortBtn current={sortBy} value="receita" label="Receita" onClick={setSortBy} />
        <SortBtn current={sortBy} value="recent" label="Mais recentes" onClick={setSortBy} />
      </div>

      {/* Tabela */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-3 py-2.5 font-semibold text-gray-700">Campanha</th>
                <th className="text-right px-3 py-2.5 font-semibold text-gray-700">Enviadas</th>
                <th className="text-right px-3 py-2.5 font-semibold text-gray-700">Respostas</th>
                <th className="text-right px-3 py-2.5 font-semibold text-gray-700">Contatos</th>
                <th className="text-right px-3 py-2.5 font-semibold text-gray-700">Deals</th>
                <th className="text-right px-3 py-2.5 font-semibold text-gray-700">Ganhos</th>
                <th className="text-right px-3 py-2.5 font-semibold text-gray-700">Receita</th>
                <th className="text-right px-3 py-2.5 font-semibold text-gray-700">CAC</th>
                <th className="text-right px-3 py-2.5 font-semibold text-gray-700">ROI</th>
              </tr>
            </thead>
            <tbody>
              {campanhasOrdenadas.map((c) => (
                <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2.5">
                    <div className="font-medium text-gray-900 truncate max-w-[180px]" title={c.name}>
                      {c.name}
                    </div>
                    <div className="text-[10px] text-gray-400">
                      {c.type} · {c.status.toLowerCase()}
                    </div>
                  </td>
                  <td className="text-right px-3 py-2.5 text-gray-700">{c.sentCount.toLocaleString('pt-BR')}</td>
                  <td className="text-right px-3 py-2.5 text-gray-700">
                    {c.repliedCount.toLocaleString('pt-BR')}
                    <div className="text-[10px] text-gray-400">{fmtPct(c.replyRate, 0)}</div>
                  </td>
                  <td className="text-right px-3 py-2.5 text-gray-700">{c.contactsCreated}</td>
                  <td className="text-right px-3 py-2.5 text-gray-700">{c.dealsCreated}</td>
                  <td className="text-right px-3 py-2.5 text-gray-700">
                    {c.dealsWon}
                    <div className="text-[10px] text-gray-400">{fmtPct(c.conversionRate, 0)}</div>
                  </td>
                  <td className="text-right px-3 py-2.5 font-semibold text-green-700">
                    {fmtBRL(c.receitaTotal)}
                    {c.dealsWon > 0 && (
                      <div className="text-[10px] text-gray-400 font-normal">
                        ticket {fmtBRL(c.ticketMedio)}
                      </div>
                    )}
                  </td>
                  <td className="text-right px-3 py-2.5 text-gray-600">{fmtBRL(c.cacEstimado)}</td>
                  <td className="text-right px-3 py-2.5">
                    <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${roiColor(c.roi)}`}>
                      {c.cacEstimado > 0 ? fmtRoi(c.roi) : '—'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Aviso sobre CAC estimado */}
      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-900">
        <strong>Como o CAC é calculado:</strong> {data.assumptions.note}
      </div>
    </div>
  );
}

function KpiBig({
  label,
  value,
  sub,
  icon,
  tint,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
  tint: 'green' | 'red' | 'blue' | 'purple';
}) {
  const colors = {
    green: { bg: 'bg-green-50 border-green-200', text: 'text-green-900', iconBg: 'bg-green-100 text-green-700' },
    red: { bg: 'bg-red-50 border-red-200', text: 'text-red-900', iconBg: 'bg-red-100 text-red-700' },
    blue: { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-900', iconBg: 'bg-blue-100 text-blue-700' },
    purple: { bg: 'bg-purple-50 border-purple-200', text: 'text-purple-900', iconBg: 'bg-purple-100 text-purple-700' },
  }[tint];
  return (
    <div className={`rounded-lg border p-4 ${colors.bg}`}>
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-7 h-7 rounded flex items-center justify-center ${colors.iconBg}`}>{icon}</div>
        <span className={`text-[10px] font-semibold uppercase tracking-wide ${colors.text} opacity-70`}>
          {label}
        </span>
      </div>
      <div className={`text-2xl font-bold ${colors.text} leading-tight`}>{value}</div>
      <div className="text-[11px] text-gray-500 mt-1 truncate" title={sub}>
        {sub}
      </div>
    </div>
  );
}

function SortBtn({
  current,
  value,
  label,
  onClick,
}: {
  current: string;
  value: 'roi' | 'receita' | 'recent';
  label: string;
  onClick: (v: 'roi' | 'receita' | 'recent') => void;
}) {
  const active = current === value;
  return (
    <button
      onClick={() => onClick(value)}
      className={`text-xs px-2.5 py-1 rounded border ${
        active
          ? 'bg-primary-100 border-primary-300 text-primary-900 font-semibold'
          : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
      }`}
    >
      {label}
    </button>
  );
}
