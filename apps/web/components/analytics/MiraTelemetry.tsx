'use client';

/**
 * MiraTelemetry — bloco de observabilidade do add-on Mira Prospects no /analytics.
 *
 * Só aparece para orgs com o Mira ativo (checa /api/mira-access). Mostra o
 * funil de Alvos, a cota do mês, a qualidade das fontes de enriquecimento
 * (match rate/latência, doc 08), a cobertura de decisores e a conversão em CRM.
 * Autocontido: fetch próprio + período próprio, para plugar com uma linha.
 */
import { useEffect, useState } from 'react';
import { Crosshair, Target, Users, Newspaper, TrendingUp, Gauge } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { SaibaMais } from '@/components/shared/SaibaMais';
import { miraApi, formatBRL, type MiraAnalyticsData } from '@/lib/miraApi';

const STATUS_LABEL: Record<string, string> = {
  DISCOVERED: 'Descobertos',
  QUALIFYING: 'Em qualificação',
  READY: 'Prontos',
  DELIVERED: 'Entregues',
  ARCHIVED: 'Arquivados',
};
const STATUS_COLOR: Record<string, string> = {
  DISCOVERED: '#9ca3af',
  QUALIFYING: '#f59e0b',
  READY: '#10b981',
  DELIVERED: '#6366f1',
  ARCHIVED: '#d1d5db',
};
const FONTE_LABEL: Record<string, string> = {
  cnpj_brasilapi: 'Receita (BrasilAPI)',
  cnpj_receita: 'Receita (base local)',
  google_places: 'Google Places',
  'pegada_publica:google_cse': 'Pegada pública (LinkedIn/Web)',
  'pegada_publica:brave': 'Pegada pública (Brave)',
  'pegada_publica:firecrawl': 'Pegada pública (Firecrawl)',
};
const PERIODS = [
  { key: 7, label: '7 dias' },
  { key: 30, label: '30 dias' },
  { key: 90, label: '90 dias' },
];

export function MiraTelemetry() {
  const [entitled, setEntitled] = useState<boolean | null>(null);
  const [period, setPeriod] = useState(30);
  const [data, setData] = useState<MiraAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    miraApi
      .access()
      .then((r) => alive && setEntitled(r.data.access.entitled))
      .catch(() => alive && setEntitled(false));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!entitled) return;
    let alive = true;
    setLoading(true);
    miraApi
      .analytics(period)
      .then((r) => alive && setData(r.data))
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [entitled, period]);

  if (entitled === null || entitled === false) return null;

  const funilData = data
    ? ['DISCOVERED', 'QUALIFYING', 'READY', 'DELIVERED', 'ARCHIVED']
        .filter((s) => (data.funil.byStatus[s] ?? 0) > 0)
        .map((s) => ({ status: s, label: STATUS_LABEL[s], value: data.funil.byStatus[s] ?? 0 }))
    : [];

  const kpis = data
    ? [
        { icon: Target, label: 'Alvos totais', value: String(data.funil.total), sub: `${data.funil.criadosNoPeriodo} no período` },
        { icon: TrendingUp, label: 'Prontos', value: String(data.funil.byStatus.READY ?? 0), sub: `${data.conversao.pousaramCrm} no CRM (${data.conversao.taxaCrmPct}%)` },
        { icon: Gauge, label: 'Mira Score médio', value: data.funil.scoreMedioProntos != null ? String(data.funil.scoreMedioProntos) : '—', sub: 'dos Alvos prontos' },
        { icon: Crosshair, label: 'Cota do mês', value: `${data.cota.used}/${data.cota.total}`, sub: data.cota.blocked ? 'esgotada' : `${data.cota.remaining} restantes${data.cota.packExtra ? ` (+${data.cota.packExtra} pack)` : ''}` },
        { icon: Users, label: 'Decisores', value: String(data.decisores.total), sub: `${data.decisores.qsa} QSA · ${data.decisores.pegadaPublica} web` },
      ]
    : [];

  return (
    <section className="mt-10">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <Crosshair size={18} className="text-primary-600" />
          Mira Prospects
          <SaibaMais featureKey="mira.analytics" />
        </h2>
        <div className="flex items-center gap-1">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium ${period === p.key ? 'bg-primary-600 text-white' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading || !data ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl p-5 border border-gray-100 animate-pulse h-24" />
          ))}
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
            {kpis.map((k) => (
              <div key={k.label} className="bg-white rounded-xl p-4 border border-gray-100">
                <div className="flex items-center gap-1.5 text-gray-400 mb-1.5">
                  <k.icon size={14} />
                  <span className="text-[11px] uppercase tracking-wide font-medium">{k.label}</span>
                </div>
                <p className="text-xl font-bold text-gray-900 leading-none">{k.value}</p>
                <p className="text-[11px] text-gray-400 mt-1">{k.sub}</p>
              </div>
            ))}
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {/* Funil de Alvos */}
            <div className="bg-white rounded-xl p-5 border border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Funil de Alvos</h3>
              {funilData.length === 0 ? (
                <p className="text-xs text-gray-400 italic py-8 text-center">Sem Alvos ainda. Mapeie a carteira ou descubra novos.</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={funilData} layout="vertical" margin={{ left: 20, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#9ca3af' }} />
                    <YAxis type="category" dataKey="label" width={110} tick={{ fontSize: 11, fill: '#6b7280' }} />
                    <Tooltip cursor={{ fill: '#f9fafb' }} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {funilData.map((d) => (
                        <Cell key={d.status} fill={STATUS_COLOR[d.status]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
              <div className="flex gap-4 mt-2 text-[11px] text-gray-400">
                <span>Base instalada: {data.funil.byMotor.BASE_INSTALADA ?? 0}</span>
                <span>Descoberta: {data.funil.byMotor.DESCOBERTA ?? 0}</span>
                <span>B2B: {data.funil.byKind.B2B ?? 0}</span>
                <span>B2C: {data.funil.byKind.B2C ?? 0}</span>
              </div>
            </div>

            {/* Qualidade das fontes */}
            <div className="bg-white rounded-xl p-5 border border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-1.5">
                Qualidade das fontes <SaibaMais featureKey="mira.analytics.fontes" />
              </h3>
              {data.fontes.length === 0 ? (
                <p className="text-xs text-gray-400 italic py-8 text-center">Sem consultas de enriquecimento no período.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-gray-400 text-left border-b border-gray-100">
                        <th className="py-1.5 font-medium">Fonte</th>
                        <th className="py-1.5 font-medium text-right">Consultas</th>
                        <th className="py-1.5 font-medium text-right">Match</th>
                        <th className="py-1.5 font-medium text-right">Latência</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.fontes.map((f) => (
                        <tr key={f.fonte} className="border-b border-gray-50 last:border-0">
                          <td className="py-1.5 text-gray-700">{FONTE_LABEL[f.fonte] ?? f.fonte}</td>
                          <td className="py-1.5 text-right text-gray-500">{f.total}</td>
                          <td className={`py-1.5 text-right font-medium ${f.matchRatePct >= 70 ? 'text-emerald-600' : f.matchRatePct >= 40 ? 'text-amber-600' : 'text-gray-400'}`}>
                            {f.matchRatePct}%
                          </td>
                          <td className="py-1.5 text-right text-gray-500">{f.latenciaMediaMs != null ? `${f.latenciaMediaMs}ms` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-50 text-[11px] text-gray-400">
                <span className="inline-flex items-center gap-1">
                  <Newspaper size={12} /> {data.releases.totalNoPeriodo} releases no período
                </span>
                <span>{data.releases.naoLidos} não lidos</span>
                {data.cota.packsComprados > 0 && <span>{data.cota.packsComprados} pack(s) no mês</span>}
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
