'use client';

/**
 * ContaClara.tsx · Conta Clara beta (Resposta Meta out/2026, PR-J).
 *
 * Seção da página /billing com o extrato do custo Meta por mensagem do mês,
 * vindo de GET /api/billing/meta-costs (ledger meta_billing_events ×
 * metaRateCard). Mostra: medidor do mês (total + barra contra a projeção),
 * quebra por categoria com contagem, projeção linear, mini tabela dos
 * últimos 7 dias com movimento, conversas que mais custaram (telefone SEMPRE
 * mascarado pela API) e o aviso de que a tarifa é da Meta, sem markup.
 *
 * Antes de 01/10/2026 a categoria de atendimento (service) aparece com
 * contagem real e R$ 0: é o rate card vigente na data de cada evento.
 * Sem eventos no mês, a seção vira um card explicativo, não um erro.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Receipt, TrendingUp, Info, MessageSquare } from 'lucide-react';
import { api } from '../../../lib/api';

type MetaCostCategory = { category: string; count: number; costBrl: number };
type MetaCostDay = { date: string; count: number; costBrl: number };
type MetaCostConversation = {
  conversationId: string;
  count: number;
  costBrl: number;
  contactName: string | null;
  contactPhoneMasked: string | null;
};
type MetaCosts = {
  month: string;
  totalBrl: number;
  byCategory: MetaCostCategory[];
  byDay: MetaCostDay[];
  projection: { projectedTotalBrl: number; daysElapsed: number; daysInMonth: number };
  topConversations: MetaCostConversation[];
  freeBreakdown: { freeEntryPoint: number; freeCustomerService: number };
};

const CATEGORY_LABELS: Record<string, string> = {
  marketing: 'Marketing',
  utility: 'Utilidade',
  authentication: 'Autenticação',
  service: 'Atendimento (janela de 24h)',
};

function brl(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** dd/mm direto da string YYYY-MM-DD (sem new Date, que deslocaria o dia no fuso local). */
function dayLabel(isoDay: string): string {
  return `${isoDay.slice(8, 10)}/${isoDay.slice(5, 7)}`;
}

/** "agosto de 2026" a partir de YYYY-MM. */
function monthLabel(month: string): string {
  const d = new Date(`${month}-15T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return month;
  return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export function ContaClara() {
  const [data, setData] = useState<MetaCosts | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await api.get('/api/billing/meta-costs');
        if (active && res?.data) setData(res.data as MetaCosts);
      } catch {
        // fail-soft: a seção mostra o estado indisponível, sem quebrar a página
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const isEmpty =
    !!data &&
    data.byCategory.length === 0 &&
    data.freeBreakdown.freeEntryPoint === 0 &&
    data.freeBreakdown.freeCustomerService === 0;

  const totalCount = data ? data.byCategory.reduce((acc, c) => acc + c.count, 0) : 0;
  const freeCount = data
    ? data.freeBreakdown.freeEntryPoint + data.freeBreakdown.freeCustomerService
    : 0;
  // Barra do medidor: quanto da projeção do mês já foi consumido.
  const meterPct =
    data && data.projection.projectedTotalBrl > 0
      ? Math.min(100, Math.round((data.totalBrl / data.projection.projectedTotalBrl) * 100))
      : 0;
  const lastDays = data ? data.byDay.slice(-7) : [];

  return (
    <div className="mt-8 bg-white rounded-xl border border-gray-100 p-6">
      <div className="flex items-center gap-2 mb-1">
        <Receipt size={18} className="text-primary-500" />
        <h3 className="text-sm font-semibold text-gray-900">Conta Clara</h3>
        <span className="text-[10px] font-bold uppercase tracking-wide bg-primary-50 text-primary-600 px-1.5 py-0.5 rounded-full">
          Beta
        </span>
      </div>
      <p className="text-xs text-gray-500 mb-4">
        Custo das mensagens do WhatsApp tarifadas pela Meta
        {data ? ` em ${monthLabel(data.month)}` : ' neste mês'}.
      </p>

      {loading ? (
        <p className="text-sm text-gray-400">Carregando extrato...</p>
      ) : !data ? (
        <p className="text-sm text-gray-400">Não foi possível carregar o extrato agora.</p>
      ) : isEmpty ? (
        // Sem eventos no mês: card explicativo, não erro.
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 flex items-start gap-3">
          <Info size={16} className="text-gray-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-gray-700">
              Ainda não registramos mensagens tarifadas neste mês.
            </p>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
              Assim que o seu número enviar mensagens pelo WhatsApp oficial, o extrato aparece
              aqui, categoria por categoria, no valor que a Meta cobra.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Medidor do mês: total até agora + barra contra a projeção */}
          <div className="mb-5">
            <div className="flex items-end justify-between gap-4 flex-wrap">
              <div>
                <p className="text-2xl font-extrabold text-gray-900 leading-none">
                  {brl(data.totalBrl)}
                </p>
                <p className="text-[11px] text-gray-500 mt-1">
                  {totalCount.toLocaleString('pt-BR')}{' '}
                  {totalCount === 1 ? 'mensagem tarifada' : 'mensagens tarifadas'} até o dia{' '}
                  {data.projection.daysElapsed} de {data.projection.daysInMonth}
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-600">
                <TrendingUp size={14} className="text-primary-500" />
                Projeção do mês:{' '}
                <span className="font-semibold text-gray-900">
                  {brl(data.projection.projectedTotalBrl)}
                </span>
              </div>
            </div>
            <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary-500 rounded-full"
                style={{ width: `${meterPct}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Quebra por categoria com contagem */}
            <div>
              <p className="text-xs font-semibold text-gray-700 mb-2">Por categoria</p>
              <ul className="space-y-1.5">
                {data.byCategory.map((c) => (
                  <li key={c.category} className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">
                      {CATEGORY_LABELS[c.category] ?? c.category}
                      <span className="ml-1.5 text-xs text-gray-400">
                        {c.count.toLocaleString('pt-BR')} msg
                      </span>
                    </span>
                    <span className="font-semibold text-gray-900">{brl(c.costBrl)}</span>
                  </li>
                ))}
              </ul>
              {freeCount > 0 && (
                <p className="text-[11px] text-emerald-700 mt-2 leading-relaxed">
                  Grátis neste mês: {data.freeBreakdown.freeCustomerService.toLocaleString('pt-BR')}{' '}
                  na janela de atendimento e{' '}
                  {data.freeBreakdown.freeEntryPoint.toLocaleString('pt-BR')} por ponto de entrada
                  de anúncio.
                </p>
              )}
            </div>

            {/* Mini tabela dos últimos 7 dias com movimento */}
            <div>
              <p className="text-xs font-semibold text-gray-700 mb-2">Últimos dias</p>
              {lastDays.length === 0 ? (
                <p className="text-xs text-gray-400">Sem mensagens tarifadas nos últimos dias.</p>
              ) : (
                <table className="w-full text-sm">
                  <tbody>
                    {lastDays.map((d) => (
                      <tr key={d.date} className="border-b border-gray-50 last:border-0">
                        <td className="py-1 text-gray-600">{dayLabel(d.date)}</td>
                        <td className="py-1 text-right text-xs text-gray-400">
                          {d.count.toLocaleString('pt-BR')} msg
                        </td>
                        <td className="py-1 text-right font-medium text-gray-900">
                          {brl(d.costBrl)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Conversas que mais custaram (telefone já vem mascarado da API) */}
          {data.topConversations.length > 0 && (
            <div className="mt-5">
              <p className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                <MessageSquare size={13} className="text-gray-400" />
                Conversas que mais custaram
              </p>
              <ul className="space-y-1">
                {data.topConversations.slice(0, 5).map((t) => (
                  <li key={t.conversationId} className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 truncate">
                      {t.contactName || t.contactPhoneMasked || 'Contato sem nome'}
                      {t.contactName && t.contactPhoneMasked && (
                        <span className="ml-1.5 text-xs text-gray-400">{t.contactPhoneMasked}</span>
                      )}
                      <span className="ml-1.5 text-xs text-gray-400">
                        {t.count.toLocaleString('pt-BR')} msg
                      </span>
                    </span>
                    <span className="font-medium text-gray-900">{brl(t.costBrl)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {/* Aviso: a cobrança é da Meta; nós só damos visibilidade, sem markup */}
      <div className="mt-5 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
        <Info size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-amber-900 leading-relaxed">
          A tarifa é da Meta e é cobrada na sua conta com ela. Aqui você acompanha o custo, sem
          markup. A partir de 01/10 as respostas na janela de 24h passam a ser tarifadas.{' '}
          <Link href="/novidades-meta" className="font-semibold underline hover:text-amber-700">
            Entenda o que muda
          </Link>
        </p>
      </div>
    </div>
  );
}
