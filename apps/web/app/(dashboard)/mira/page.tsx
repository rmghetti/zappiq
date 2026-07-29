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
import { useRouter } from 'next/navigation';
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
  Plus,
  Search,
  Radar,
} from 'lucide-react';
import { SaibaMais } from '@/components/shared/SaibaMais';
import { NovaCampanhaModal } from '@/components/mira/NovaCampanhaModal';
import {
  miraApi,
  formatBRL,
  type MiraAccessData,
  type MiraAlvoListItem,
  type MiraCampanha,
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
        {entitled && accessData?.access.source === 'trial' && (
          <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-full">
            Teste grátis
          </span>
        )}
      </div>

      {entitled && accessData ? (
        <EntitledPanel accessData={accessData} alvos={alvos} />
      ) : (
        <ActivationShowcase accessData={accessData} onActivated={setAccessData} />
      )}
    </div>
  );
}

/* ── Painel (contratado) ─────────────────────────────────────────── */
function EntitledPanel({ accessData, alvos }: { accessData: MiraAccessData; alvos: MiraAlvoListItem[] }) {
  const { quota, perfil, monthKey, access, catalog } = accessData;
  const isTrial = access.source === 'trial';
  const pct = quota.total > 0 ? Math.min(100, Math.round((quota.used / quota.total) * 100)) : 0;
  const prontidao = perfil?.prontidao ?? 0;
  const perfilPronto = prontidao >= 60;
  const router = useRouter();
  const [subBusy, setSubBusy] = useState<string | null>(null);
  const [subError, setSubError] = useState<string | null>(null);
  const [campanhas, setCampanhas] = useState<MiraCampanha[]>([]);
  const [campLoading, setCampLoading] = useState(true);
  const [campReload, setCampReload] = useState(0);
  const [wizard, setWizard] = useState(false);

  useEffect(() => {
    let alive = true;
    miraApi
      .listCampanhas()
      .then((r) => alive && setCampanhas(r.data))
      .catch(() => {})
      .finally(() => alive && setCampLoading(false));
    return () => {
      alive = false;
    };
  }, [campReload]);

  // Veio do Perfil recém-salvo ("Criar primeira campanha")? Abre o assistente.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('novaCampanha')) setWizard(true);
  }, []);

  const subscribe = async (tierKey: string) => {
    setSubBusy(tierKey);
    setSubError(null);
    try {
      const res = await miraApi.checkout(tierKey as any, 'monthly');
      if (res.url) window.location.href = res.url;
      else setSubError('Não consegui abrir o checkout agora.');
    } catch (e: any) {
      setSubError(e?.message || 'Não foi possível iniciar a assinatura agora.');
      setSubBusy(null);
    }
  };

  return (
    <>
      {/* Faixa do teste grátis — SEMPRE visível durante o trial, não só quando
          esgota. Paridade com o PaywallGate do trial de PLANO, que informa a
          limitação e oferece a assinatura desde o primeiro dia.
          Pedido da fundação (16/07/2026): "informar qual a limitação e sempre
          dar a opção dele contratar". Antes, a oferta só aparecia DEPOIS do
          teste esgotar — quando o cliente já tinha parado de conseguir usar.
          Pacote avulso NÃO entra aqui de propósito: ele recarrega a cota de
          uma faixa, e no trial não há faixa (a API recusa — ver
          miraAccess.ts). Oferecer seria vender o que não funciona. */}
      {isTrial && !quota.blocked && (
        <div className={`rounded-xl px-4 py-3 mb-4 border ${
          quota.remaining <= 3 ? 'bg-amber-50 border-amber-200' : 'bg-primary-50/60 border-primary-100'
        }`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-800">
                Você está no teste grátis do Mira · {quota.used} de {quota.total} Alvos usados ·{' '}
                {quota.remaining === 1 ? 'falta 1' : `faltam ${quota.remaining}`}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                O teste é um teto único de {quota.total} Alvos e não renova na virada do mês.
                Assine uma faixa para continuar sem interrupção (no anual você trava 20% de desconto).
              </p>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              {catalog.tiers.map((t) => (
                <button
                  key={t.key}
                  onClick={() => subscribe(t.key)}
                  disabled={subBusy !== null}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-60"
                >
                  {subBusy === t.key ? 'Abrindo…' : `${t.name} · ${formatBRL(t.priceMonthly)}/mês`}
                </button>
              ))}
            </div>
          </div>
          {subError && <p className="text-xs text-red-500 mt-2">{subError}</p>}
        </div>
      )}

      {/* Cota + Prontidão */}
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
              {isTrial ? 'Alvos do teste grátis' : `Alvos do mês (${monthKey})`}
              <SaibaMais featureKey="mira.quota" />
            </h3>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${quota.blocked ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
              {quota.blocked ? (isTrial ? 'Teste esgotado' : 'Cota esgotada') : `${quota.remaining} restantes`}
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
          {quota.packExtra > 0 && !isTrial && (
            <p className="text-xs text-gray-400 mt-2">Inclui +{quota.packExtra} de pack avulso neste mês.</p>
          )}
          {quota.blocked && !isTrial && (
            /* O pack se compra na fila de Alvos (ComprarPacks), NÃO em
               /billing — o /billing nem lista o Mira. A instrução antiga
               mandava o cliente pro lugar errado. */
            <p className="text-xs text-gray-500 mt-2">
              A geração de novos Alvos volta na virada do mês, ou compre um pacote avulso em{' '}
              <Link href="/mira/alvos" className="text-primary-600 font-medium hover:underline">
                Alvos
              </Link>
              .
            </p>
          )}
          {quota.blocked && isTrial && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-xs text-gray-600 mb-2">
                Seu teste grátis acabou. Assine uma faixa para continuar gerando Alvos:
              </p>
              <div className="flex flex-wrap gap-2">
                {catalog.tiers.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => subscribe(t.key)}
                    disabled={subBusy !== null}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium border border-primary-200 text-primary-700 hover:bg-primary-50 disabled:opacity-60"
                  >
                    {subBusy === t.key ? 'Abrindo…' : `${t.name} · ${formatBRL(t.priceMonthly)}/mês`}
                  </button>
                ))}
              </div>
              {subError && <p className="text-xs text-red-500 mt-2">{subError}</p>}
            </div>
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

      {/* Campanhas de prospecção: o disparo dos agentes mora AQUI. */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-gray-900 flex items-center gap-1.5">
          Campanhas de prospecção
          <SaibaMais featureKey="mira.campanhas" />
        </h2>
        <button
          onClick={() => setWizard(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700"
        >
          <Plus size={15} /> Nova campanha
        </button>
      </div>
      <div className="mb-8">
        {campLoading ? (
          <div className="flex items-center justify-center py-8 text-gray-300">
            <Loader2 className="animate-spin" size={20} />
          </div>
        ) : campanhas.length === 0 ? (
          <div className="border border-dashed border-gray-200 rounded-xl px-5 py-6 text-center">
            <p className="text-sm text-gray-500 max-w-md mx-auto">
              {perfilPronto
                ? 'Nenhuma campanha ainda. Clique em Nova campanha: os agentes saem mapeando o mercado e cada disparo fica registrado aqui, com o resultado.'
                : 'Complete o Perfil de Prospecção e crie a primeira campanha: os agentes saem mapeando e cada disparo fica registrado aqui.'}
            </p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
            {campanhas.slice(0, 5).map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center shrink-0">
                  {c.tipo === 'DESCOBERTA' ? (
                    <Search size={15} className="text-primary-600" />
                  ) : (
                    <Radar size={15} className="text-primary-600" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">{c.nome}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(c.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                    {' · '}
                    {c.alvosCount} {c.alvosCount === 1 ? 'alvo' : 'alvos'} · {c.prontosCount} prontos
                    {c.status === 'FALHOU' && <span className="text-red-500"> · falhou</span>}
                    {c.status === 'EM_ANDAMENTO' && <span className="text-amber-600"> · em andamento</span>}
                  </p>
                </div>
                <Link
                  href={`/mira/alvos?campanha=${c.id}`}
                  className="text-xs font-medium text-primary-600 hover:underline shrink-0"
                >
                  ver alvos
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      {wizard && (
        <NovaCampanhaModal
          onClose={() => setWizard(false)}
          onDone={(campanhaId) => {
            setWizard(false);
            setCampReload((k) => k + 1);
            router.push(campanhaId ? `/mira/alvos?campanha=${campanhaId}` : '/mira/alvos');
          }}
        />
      )}

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
              ? 'Crie a primeira campanha de prospecção: os agentes saem mapeando e os Alvos aparecem aqui.'
              : 'Complete o Perfil de Prospecção para os agentes começarem a mapear.'}
          </p>
          {perfilPronto ? (
            <button
              onClick={() => setWizard(true)}
              className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700"
            >
              <Plus size={15} /> Nova campanha
            </button>
          ) : (
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
function ActivationShowcase({
  accessData,
  onActivated,
}: {
  accessData: MiraAccessData | null;
  onActivated: (data: MiraAccessData) => void;
}) {
  const eligible = accessData?.access.eligible ?? false;
  const trialAvailable = accessData?.access.trialAvailable ?? false;
  const trialAlvos = accessData?.catalog.trialAlvos ?? 10;
  const tiers = accessData?.catalog.tiers ?? [];
  const [cycle, setCycle] = useState<'monthly' | 'annual'>('monthly');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ativando, setAtivando] = useState(false);
  const [trialBusy, setTrialBusy] = useState(false);
  const [trialError, setTrialError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('ativado=1')) setAtivando(true);
  }, []);

  const activateTrial = async () => {
    setTrialBusy(true);
    setTrialError(null);
    try {
      const res = await miraApi.activateTrial();
      onActivated(res.data);
    } catch (e: any) {
      setTrialError(e?.message || 'Não foi possível ativar o teste agora.');
    } finally {
      setTrialBusy(false);
    }
  };

  const subscribe = async (tierKey: string) => {
    setBusy(tierKey);
    setError(null);
    try {
      const res = await miraApi.checkout(tierKey as any, cycle);
      if (res.url) window.location.href = res.url;
      else setError('Não consegui abrir o checkout agora.');
    } catch (e: any) {
      if (e?.status === 503) setError('O pagamento ainda não está configurado nesta instalação.');
      else setError(e?.message || 'Não foi possível iniciar a assinatura agora.');
      setBusy(null);
    }
  };

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

      {eligible && trialAvailable && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-gray-900">Quer testar antes de assinar?</p>
            <p className="text-xs text-gray-600 mt-0.5">
              {trialAlvos} Alvos grátis, sem cartão e sem compromisso. Dá pra ver o dossiê completo antes de escolher a faixa.
            </p>
          </div>
          <button
            onClick={activateTrial}
            disabled={trialBusy}
            className="px-4 py-2.5 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 shrink-0 disabled:opacity-60 inline-flex items-center gap-1.5"
          >
            {trialBusy ? <Loader2 className="animate-spin" size={15} /> : null}
            {trialBusy ? 'Ativando…' : `Testar grátis com ${trialAlvos} Alvos`}
          </button>
        </div>
      )}
      {trialError && <p className="text-xs text-red-500 mb-4 text-center">{trialError}</p>}

      {ativando && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-3 mb-6 flex items-center gap-2">
          <Loader2 className="animate-spin text-emerald-600" size={16} />
          <p className="text-sm text-emerald-700">
            Pagamento recebido, ativando o Mira Prospects. Em alguns segundos as telas liberam, atualize a página se demorar.
          </p>
        </div>
      )}

      {/* Ciclo */}
      {eligible && (
        <div className="flex items-center justify-center gap-2 mb-4">
          <button
            onClick={() => setCycle('monthly')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${cycle === 'monthly' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}
          >
            Mensal
          </button>
          <button
            onClick={() => setCycle('annual')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${cycle === 'annual' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}
          >
            Anual <span className="text-[10px] opacity-80">(-20%)</span>
          </button>
        </div>
      )}

      {/* Faixas */}
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        {tiers.map((t) => {
          const annualMonthly = Math.round(t.priceMonthly * (1 - t.annualDiscountPercent / 100));
          const shown = cycle === 'annual' ? annualMonthly : t.priceMonthly;
          return (
            <div
              key={t.key}
              className={`bg-white rounded-xl p-5 border flex flex-col ${t.highlight ? 'border-primary-400 shadow-sm relative' : 'border-gray-200'}`}
            >
              {t.highlight && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-primary-600 text-white text-[10px] font-semibold px-2.5 py-0.5 rounded-full">
                  Mais escolhido
                </span>
              )}
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">{t.name}</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatBRL(shown)}
                <span className="text-sm font-medium text-gray-400">/mês</span>
              </p>
              <p className="text-sm text-gray-500 mt-1.5">{t.alvosPerMonth} Alvos verificados por mês</p>
              <p className="text-xs text-gray-400 mt-1">
                {cycle === 'annual' ? `Cobrado anual (${formatBRL(annualMonthly * 12)}/ano)` : `Anual: ${formatBRL(annualMonthly)}/mês`}
              </p>
              {eligible && (
                <button
                  onClick={() => subscribe(t.key)}
                  disabled={busy !== null}
                  className={`mt-4 inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60 ${
                    t.highlight ? 'bg-primary-600 text-white hover:bg-primary-700' : 'border border-primary-200 text-primary-700 hover:bg-primary-50'
                  }`}
                >
                  {busy === t.key ? <Loader2 className="animate-spin" size={15} /> : null}
                  {busy === t.key ? 'Abrindo checkout…' : `Assinar ${t.name}`}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {error && <p className="text-xs text-red-500 mb-4 text-center">{error}</p>}

      {/* CTA */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {eligible ? (
          <>
            <div className="flex items-start gap-3">
              <TrendingUp className="text-primary-600 shrink-0 mt-0.5" size={20} />
              <div>
                <p className="text-sm font-semibold text-gray-900">Escolha uma faixa acima para ativar</p>
                <p className="text-xs text-gray-500">
                  Checkout seguro no Stripe. Zero taxa de setup, sem fidelidade além do ciclo. Você pode trocar de faixa depois.
                </p>
              </div>
            </div>
            <button
              onClick={() => subscribe(tiers.find((t) => t.highlight)?.key ?? tiers[0]?.key ?? 'MIRA_PRO')}
              disabled={busy !== null || tiers.length === 0}
              className="px-4 py-2.5 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 shrink-0 disabled:opacity-60 inline-flex items-center gap-1.5"
            >
              {busy ? <Loader2 className="animate-spin" size={15} /> : null}
              Ativar o Mira Prospects
            </button>
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
