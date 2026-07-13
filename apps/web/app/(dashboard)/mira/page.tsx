'use client';

/**
 * Mira Prospects — Visão geral (/(dashboard)/mira)
 *
 * Página-mãe do add-on. Dois estados:
 *   1. NÃO contratado → vitrine de ativação (faixas, o que entrega, CTA
 *      pra /billing). Menu é sempre visível; a conversão acontece aqui.
 *   2. Contratado → painel: cota do mês (usados/total), prontidão do
 *      Perfil de Prospecção, atalhos e últimos Alvos.
 *
 * Fonte de status: GET /api/mira-access (não gated). Alvos: /api/mira/*.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Crosshair,
  Loader2,
  ArrowRight,
  Target,
  Newspaper,
  FileSpreadsheet,
  ClipboardList,
  CheckCircle2,
  Lock,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { SaibaMais } from '@/components/shared/SaibaMais';
import {
  miraApi,
  formatBRL,
  type MiraAccessData,
  type MiraAlvoListItem,
} from '@/lib/miraApi';

export default function MiraOverviewPage() {
  const [loading, setLoading] = useState(true);
  const [accessData, setAccessData] = useState<MiraAccessData | null>(null);
  const [alvos, setAlvos] = useState<MiraAlvoListItem[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await miraApi.access();
        if (!alive) return;
        setAccessData(res.data);
        if (res.data.access.entitled) {
          const list = await miraApi.listAlvos();
          if (!alive) return;
          setAlvos(list.data.alvos.slice(0, 6));
        }
      } catch {
        // AuthGuard/paywall do apiClient já tratam 401/402
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32 text-gray-400">
        <Loader2 className="animate-spin" size={28} />
      </div>
    );
  }

  const entitled = accessData?.access.entitled ?? false;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center">
            <Crosshair className="text-primary-600" size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-1.5">
              Mira Prospects
              <SaibaMais featureKey="mira.overview" />
            </h1>
            <p className="text-sm text-gray-500">
              Inteligência que encontra, qualifica e entrega quem está pronto para comprar.
            </p>
          </div>
        </div>
        {entitled && accessData?.access.tier && (
          <span className="text-xs font-semibold text-primary-700 bg-primary-50 border border-primary-100 px-3 py-1.5 rounded-full">
            {accessData.catalog.tiers.find((t) => t.key === accessData.access.tier)?.name ?? accessData.access.tier}
            {accessData.access.source === 'included' && ' · incluído no plano'}
          </span>
        )}
      </div>

      {entitled && accessData ? (
        <EntitledPanel accessData={accessData} alvos={alvos} />
      ) : (
        <ActivationShowcase accessData={accessData} />
      )}
    </div>
  );
}

/* ── Painel (contratado) ─────────────────────────────────────────── */
function EntitledPanel({ accessData, alvos }: { accessData: MiraAccessData; alvos: MiraAlvoListItem[] }) {
  const { quota, perfil, monthKey } = accessData;
  const pct = quota.total > 0 ? Math.min(100, Math.round((quota.used / quota.total) * 100)) : 0;
  const prontidao = perfil?.prontidao ?? 0;
  const perfilPronto = prontidao >= 60;

  return (
    <>
      {/* Cota + Prontidão */}
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
              Alvos do mês ({monthKey})
              <SaibaMais featureKey="mira.quota" />
            </h3>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${quota.blocked ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
              {quota.blocked ? 'Cota esgotada' : `${quota.remaining} restantes`}
            </span>
          </div>
          <div className="text-2xl font-bold text-gray-900 mb-2">
            {quota.used}
            <span className="text-base font-medium text-gray-400"> / {quota.total}</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${quota.blocked ? 'bg-red-400' : 'bg-primary-500'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          {quota.packExtra > 0 && (
            <p className="text-xs text-gray-400 mt-2">Inclui +{quota.packExtra} de pack avulso neste mês.</p>
          )}
          {quota.blocked && (
            <p className="text-xs text-gray-500 mt-2">
              A geração de novos Alvos volta na virada do mês, ou contrate um pack avulso em{' '}
              <Link href="/billing" className="text-primary-600 font-medium hover:underline">
                Plano &amp; Fatura
              </Link>
              .
            </p>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
              Perfil de Prospecção
              <SaibaMais featureKey="mira.perfil" />
            </h3>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${perfilPronto ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
              {prontidao}% pronto
            </span>
          </div>
          <p className="text-sm text-gray-500 mb-3">
            {perfilPronto
              ? 'Perfil pronto. Os agentes já sabem o que procurar e como qualificar.'
              : 'Complete o perfil para os agentes saberem exatamente o que procurar. Leva poucos minutos.'}
          </p>
          <Link
            href="/mira/perfil"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:underline"
          >
            {perfilPronto ? 'Revisar perfil' : 'Completar perfil'} <ArrowRight size={14} />
          </Link>
        </div>
      </div>

      {/* Atalhos */}
      <div className="grid sm:grid-cols-3 gap-3 mb-8">
        <QuickLink href="/mira/alvos" icon={Target} title="Alvos" desc="Fila priorizada pelo Mira Score" />
        <QuickLink href="/mira/releases" icon={Newspaper} title="Releases dos Alvos" desc="Novidades semanais das contas" />
        <QuickLink href="/mira/relatorios" icon={FileSpreadsheet} title="Relatórios" desc="Exportar leads qualificados" />
      </div>

      {/* Últimos alvos */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-gray-900">Últimos Alvos</h2>
        <Link href="/mira/alvos" className="text-sm text-primary-600 font-medium hover:underline">
          ver todos
        </Link>
      </div>
      {alvos.length === 0 ? (
        <div className="text-center py-14 border border-dashed border-gray-200 rounded-xl">
          <Crosshair className="mx-auto text-gray-300 mb-3" size={40} />
          <p className="text-gray-500 font-medium">Nenhum Alvo ainda</p>
          <p className="text-sm text-gray-400 mt-1 max-w-md mx-auto">
            {perfilPronto
              ? 'Os motores de mapeamento entram em operação em breve. Os primeiros Alvos aparecem aqui.'
              : 'Complete o Perfil de Prospecção para os agentes começarem a mapear.'}
          </p>
          {!perfilPronto && (
            <Link
              href="/mira/perfil"
              className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700"
            >
              <ClipboardList size={15} /> Completar perfil
            </Link>
          )}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {alvos.map((a) => (
            <Link
              key={a.id}
              href={`/mira/alvos/${a.id}`}
              className="bg-white border border-gray-200 rounded-xl p-4 hover:border-primary-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-gray-900 truncate">{a.nomeFantasia || a.nome}</span>
                {a.miraScore !== null && (
                  <span className="text-xs font-bold text-primary-700 bg-primary-50 px-2 py-0.5 rounded-full shrink-0 ml-2">
                    {a.miraScore}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400">
                {[a.municipio, a.uf].filter(Boolean).join('/')} {a.cnae ? `· CNAE ${a.cnae}` : ''}
              </p>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

function QuickLink({ href, icon: Icon, title, desc }: { href: string; icon: any; title: string; desc: string }) {
  return (
    <Link
      href={href}
      className="bg-white border border-gray-200 rounded-xl p-4 hover:border-primary-300 hover:shadow-sm transition-all flex items-start gap-3"
    >
      <div className="w-9 h-9 rounded-lg bg-primary-50 flex items-center justify-center shrink-0">
        <Icon className="text-primary-600" size={18} />
      </div>
      <div>
        <p className="text-sm font-semibold text-gray-900">{title}</p>
        <p className="text-xs text-gray-500">{desc}</p>
      </div>
    </Link>
  );
}

/* ── Vitrine (não contratado) ────────────────────────────────────── */
function ActivationShowcase({ accessData }: { accessData: MiraAccessData | null }) {
  const eligible = accessData?.access.eligible ?? false;
  const tiers = accessData?.catalog.tiers ?? [];

  const entregas = [
    'Alvos qualificados com dossiê completo: quem decide, a dor, a oportunidade do seu portfólio',
    'Mira Score explicável: a fila de prospecção priorizada pelo que tem mais chance de fechar',
    'Comitê de compra nominal por papel (quem aprova, quem decide, quem pode vetar)',
    'Releases dos Alvos: vigilância semanal das suas contas com o gancho de abordagem',
    'Tudo grava no CRM da ZappIQ e sai em relatório. WhatsApp opcional.',
  ];

  return (
    <>
      {/* Hero da vitrine */}
      <div className="bg-gradient-to-br from-primary-600 to-primary-700 rounded-2xl p-8 text-white mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={16} className="text-primary-200" />
          <span className="text-xs font-semibold uppercase tracking-wider text-primary-100">
            Novo add-on
          </span>
        </div>
        <h2 className="text-2xl font-bold mb-2 max-w-2xl">
          Você diz o que vende e para quem. A Mira encontra, qualifica e entrega quem está pronto para comprar.
        </h2>
        <p className="text-primary-100 text-sm max-w-2xl">
          Agentes de IA mapeiam o seu mercado no dado público brasileiro (CNPJ, quadro societário, sinais),
          qualificam cada conta em profundidade e entregam a oportunidade pronta para trabalhar.
        </p>
      </div>

      {/* O que entrega */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-1.5">
          O que o Mira Prospects entrega <SaibaMais featureKey="mira.overview" />
        </h3>
        <ul className="space-y-2.5">
          {entregas.map((e) => (
            <li key={e} className="flex items-start gap-2 text-sm text-gray-600">
              <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" />
              <span>{e}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Faixas */}
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        {tiers.map((t) => (
          <div
            key={t.key}
            className={`bg-white rounded-xl p-5 border ${t.highlight ? 'border-primary-400 shadow-sm relative' : 'border-gray-200'}`}
          >
            {t.highlight && (
              <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-primary-600 text-white text-[10px] font-semibold px-2.5 py-0.5 rounded-full">
                Mais escolhido
              </span>
            )}
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">{t.name}</p>
            <p className="text-2xl font-bold text-gray-900">
              {formatBRL(t.priceMonthly)}
              <span className="text-sm font-medium text-gray-400">/mês</span>
            </p>
            <p className="text-sm text-gray-500 mt-1.5">
              {t.alvosPerMonth} Alvos verificados por mês
            </p>
            <p className="text-xs text-gray-400 mt-1">
              No plano anual: {formatBRL(Math.round(t.priceMonthly * (1 - t.annualDiscountPercent / 100)))} /mês
            </p>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {eligible ? (
          <>
            <div className="flex items-start gap-3">
              <TrendingUp className="text-primary-600 shrink-0 mt-0.5" size={20} />
              <div>
                <p className="text-sm font-semibold text-gray-900">Disponível para o seu plano</p>
                <p className="text-xs text-gray-500">
                  Ative em Plano &amp; Fatura. Zero taxa de setup, sem fidelidade além do ciclo.
                </p>
              </div>
            </div>
            <Link
              href="/billing"
              className="px-4 py-2.5 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 shrink-0"
            >
              Ativar o Mira Prospects
            </Link>
          </>
        ) : (
          <>
            <div className="flex items-start gap-3">
              <Lock className="text-gray-400 shrink-0 mt-0.5" size={20} />
              <div>
                <p className="text-sm font-semibold text-gray-900">Disponível a partir do plano Growth</p>
                <p className="text-xs text-gray-500">
                  Faça o upgrade do seu plano para ativar a inteligência de oportunidades.
                </p>
              </div>
            </div>
            <Link
              href="/billing"
              className="px-4 py-2.5 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-black shrink-0"
            >
              Ver planos
            </Link>
          </>
        )}
      </div>
    </>
  );
}
