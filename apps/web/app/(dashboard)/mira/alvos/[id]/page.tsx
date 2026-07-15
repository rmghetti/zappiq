'use client';

/**
 * Mira Prospects — Dossiê do Alvo (/(dashboard)/mira/alvos/[id])
 *
 * Os 8 blocos do Alvo: Mira Score explicável, comitê de compra,
 * demandas nº1/nº2, oportunidades de portfólio, incumbentes, janela
 * de entrada, perfil do sponsor (dentro do comitê) e roteiro (nas
 * oportunidades). Confiança sempre visível: dossiê raso aparece raso.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  Loader2,
  Building2,
  Store,
  Users,
  Flame,
  PackageSearch,
  Swords,
  DoorOpen,
  Newspaper,
  ShieldCheck,
  ExternalLink,
  Crown,
  Send,
  Archive,
  CheckCircle2,
  Sparkles,
  MessageSquareText,
  UserSearch,
  Globe,
  Linkedin,
} from 'lucide-react';
import { SaibaMais } from '@/components/shared/SaibaMais';
import { miraApi, type MiraAlvoDossie } from '@/lib/miraApi';

/**
 * Cada fator do Mira Score tem o seu Saiba mais. A chave é o NOME do fator
 * como o score.ts (na API) o escreve: se mudar lá, o help some daqui (falha
 * silenciosa e segura do <SaibaMais />). O teste de contrato em
 * content/saiba-mais/__tests__/scoreFatores.test.ts é o alarme disso.
 */
const SCORE_FATOR_HELP: Record<string, string> = {
  'Fit de ICP': 'mira.score.fit',
  'Demanda e sinais': 'mira.score.demanda',
  'Cobertura de decisores': 'mira.score.decisores',
  'Encaixe de portfólio': 'mira.score.portfolio',
  'Janela e incumbente': 'mira.score.janela',
};

export default function MiraAlvoDossiePage() {
  const params = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [alvo, setAlvo] = useState<MiraAlvoDossie | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!params?.id) return;
    let alive = true;
    miraApi
      .getAlvo(params.id)
      .then((res) => alive && setAlvo(res.data))
      .catch(() => alive && setNotFound(true))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [params?.id, reloadKey]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32 text-gray-400">
        <Loader2 className="animate-spin" size={28} />
      </div>
    );
  }

  if (notFound || !alvo) {
    return (
      <div className="p-6 max-w-3xl mx-auto text-center py-24">
        <p className="text-gray-500 font-medium">Alvo não encontrado.</p>
        <Link href="/mira/alvos" className="text-primary-600 text-sm font-medium hover:underline mt-2 inline-block">
          Voltar para a fila de Alvos
        </Link>
      </div>
    );
  }

  const conf = alvo.confianca ?? 0;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Link href="/mira/alvos" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 mb-4">
        <ArrowLeft size={14} /> Alvos
      </Link>

      {/* Cabeçalho do Alvo */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-primary-50 flex items-center justify-center shrink-0">
              {alvo.kind === 'B2B' ? (
                <Building2 className="text-primary-600" size={22} />
              ) : (
                <Store className="text-primary-600" size={22} />
              )}
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-gray-900 truncate flex items-center gap-1.5">
                {alvo.nomeFantasia || alvo.nome}
                <SaibaMais featureKey="mira.dossie" />
              </h1>
              <p className="text-xs text-gray-400">
                {[
                  alvo.cnpj ? `CNPJ ${alvo.cnpj}` : null,
                  alvo.porte,
                  alvo.situacaoCadastral,
                  [alvo.municipio, alvo.uf].filter(Boolean).join('/'),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-5">
            <ScoreRing label="Mira Score" value={alvo.miraScore} />
            <div className="text-right">
              <p className={`text-sm font-bold ${conf >= 70 ? 'text-emerald-600' : conf >= 40 ? 'text-amber-600' : 'text-gray-400'}`}>
                {conf}%
              </p>
              <p className="text-[10px] uppercase tracking-wide text-gray-400">Confiança</p>
            </div>
          </div>
        </div>
        {alvo.resumo && <p className="text-sm text-gray-600 mt-4 leading-relaxed">{alvo.resumo}</p>}

        <AlvoActions
          alvo={alvo}
          onChange={(patch) => setAlvo((a) => (a ? { ...a, ...patch } : a))}
          onReload={() => setReloadKey((k) => k + 1)}
        />

        {/* Por que essa nota (score breakdown) */}
        {alvo.scoreBreakdown?.fatores?.length ? (
          <div className="mt-4 border-t border-gray-100 pt-3">
            <p className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1.5">
              Por que essa nota <SaibaMais featureKey="mira.score" />
            </p>
            <div className="space-y-2.5">
              {alvo.scoreBreakdown.fatores.map((f) => (
                <div key={f.nome}>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="w-40 text-gray-500 shrink-0 flex items-center gap-1">
                      {f.nome}
                      {SCORE_FATOR_HELP[f.nome] && <SaibaMais featureKey={SCORE_FATOR_HELP[f.nome]} />}
                    </span>
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      {/* primary-500, não 400: a paleta do tailwind.config.js só
                          define DEFAULT/500/600, então `bg-primary-400` não gera
                          CSS nenhum e a barra ficou TRANSPARENTE desde sempre
                          (confirmado no CSS de produção: a classe não existe).
                          A nota aparecia; o preenchimento, nunca. */}
                      <div
                        className="h-full bg-primary-500 rounded-full"
                        style={{ width: `${Math.min(100, Math.round((f.valor / Math.max(1, f.peso)) * 100))}%` }}
                      />
                    </div>
                    <span className="w-12 text-right font-medium text-gray-600 shrink-0">
                      {f.valor}/{f.peso}
                    </span>
                  </div>
                  {/* O motivo explica a nota DESTA conta ("CNAE bate com o ICP",
                      "pesquisamos e não achamos"). O motor sempre calculou, mas
                      a tela nunca mostrou: barra sem motivo é nota opaca, que é
                      exatamente o que o Mira Score promete não ser. */}
                  {f.motivo && <p className="text-[11px] text-gray-400 mt-1 ml-[172px] leading-snug">{f.motivo}</p>}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Comitê de compra */}
        <Bloco icon={Users} title="Comitê de compra" featureKey="mira.dossie.comite" full>
          {alvo.decisores.length === 0 ? (
            <Vazio texto="Decisores ainda não mapeados para este Alvo." />
          ) : (
            <div className="grid sm:grid-cols-2 gap-2.5">
              {alvo.decisores.map((d) => (
                <div key={d.id} className="border border-gray-100 bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-gray-900 truncate">{d.nome}</p>
                    {d.isChampion && <Crown size={13} className="text-amber-500 shrink-0" aria-label="Provável champion" />}
                  </div>
                  <p className="text-xs text-gray-500">{d.papel}</p>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    {d.vinculoQsa && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">
                        <ShieldCheck size={10} /> QSA
                      </span>
                    )}
                    {!d.vinculoQsa && (d.perfilPublico?.fontes?.length || d.fonte) ? (
                      d.fonte?.includes('linkedin') || d.perfilPublico?.fontes?.some((f) => f.includes('linkedin')) ? (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-[#0a66c2] bg-sky-50 px-1.5 py-0.5 rounded-full">
                          <Linkedin size={10} /> LinkedIn
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-sky-600 bg-sky-50 px-1.5 py-0.5 rounded-full">
                          <Globe size={10} /> web
                        </span>
                      )
                    ) : null}
                    <span className="text-[10px] text-gray-400">{d.confianca}% conf.</span>
                  </div>
                  {d.perfilPublico?.ganchos?.length ? (
                    <p className="text-[11px] text-gray-500 mt-1.5 line-clamp-2">
                      Gancho: {d.perfilPublico.ganchos[0]}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </Bloco>

        {/* Demandas */}
        <Bloco icon={Flame} title="Demandas recentes" featureKey="mira.dossie.demandas">
          {alvo.demandas.length === 0 ? (
            <Vazio texto="Demandas ainda não mapeadas." />
          ) : (
            <ol className="space-y-2.5">
              {alvo.demandas.map((d) => (
                <li key={d.id} className="text-sm">
                  <span className="font-bold text-primary-600 mr-1.5">nº {d.rank}</span>
                  <span className="text-gray-700">{d.descricao}</span>
                  {d.evidencia && <p className="text-xs text-gray-400 mt-0.5 pl-6">{d.evidencia}</p>}
                </li>
              ))}
            </ol>
          )}
        </Bloco>

        {/* Oportunidades de portfólio */}
        <Bloco icon={PackageSearch} title="Oportunidades no seu portfólio" featureKey="mira.dossie.oportunidades">
          {alvo.oportunidades.length === 0 ? (
            <Vazio texto="O cruzamento demanda × catálogo aparece aqui." />
          ) : (
            <ol className="space-y-2.5">
              {alvo.oportunidades.map((o) => (
                <li key={o.id} className="text-sm">
                  <span className="font-bold text-primary-600 mr-1.5">nº {o.rank}</span>
                  <span className="font-medium text-gray-800">{o.produto}</span>
                  <p className="text-xs text-gray-500 mt-0.5 pl-6">{o.racional}</p>
                  {Array.isArray(o.roteiro?.porSponsor) && o.roteiro.porSponsor.length > 0 && (
                    <div className="mt-2 ml-6 space-y-1.5">
                      {o.roteiro.porSponsor.map((r: any, i: number) => (
                        <div key={i} className="bg-primary-50/60 border border-primary-100 rounded-lg px-3 py-2">
                          <p className="text-[11px] font-semibold text-primary-700 flex items-center gap-1">
                            <MessageSquareText size={11} /> Roteiro para {r.decisor}
                          </p>
                          <p className="text-xs text-primary-900 mt-0.5 whitespace-pre-line">{r.mensagem}</p>
                        </div>
                      ))}
                      <p className="text-[10px] text-gray-400">
                        Gerado por IA sobre os dados verificados (confiança de inferência). Revise antes de enviar.
                      </p>
                    </div>
                  )}
                </li>
              ))}
            </ol>
          )}
        </Bloco>

        {/* Incumbentes */}
        <Bloco icon={Swords} title="Fornecedores atuais" featureKey="mira.dossie.incumbentes">
          {alvo.incumbentes.length === 0 ? (
            <Vazio texto="Incumbentes ainda não identificados." />
          ) : (
            <ul className="space-y-2">
              {alvo.incumbentes.map((i) => (
                <li key={i.id} className="text-sm flex items-start justify-between gap-2">
                  <div>
                    <span className="font-medium text-gray-800">{i.fornecedor}</span>
                    {i.categoria && <span className="text-gray-400"> · {i.categoria}</span>}
                  </div>
                  {i.deslocabilidade && (
                    <span className="text-[10px] font-semibold uppercase text-gray-400 shrink-0">
                      {i.deslocabilidade}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Bloco>

        {/* Janela de entrada */}
        <Bloco icon={DoorOpen} title="Janela de entrada" featureKey="mira.dossie.janela">
          {alvo.janelaEntrada?.gatilho ? (
            <div className="text-sm text-gray-700">
              <p>
                <span className="font-medium">Gatilho:</span> {alvo.janelaEntrada.gatilho}
              </p>
              {alvo.janelaEntrada.momento && (
                <p className="mt-1">
                  <span className="font-medium">Momento:</span> {alvo.janelaEntrada.momento}
                </p>
              )}
            </div>
          ) : (
            <Vazio texto="O momento certo de abordar aparece aqui." />
          )}
        </Bloco>

        {/* Releases do alvo */}
        <Bloco icon={Newspaper} title="Releases desta conta" featureKey="mira.releases">
          {alvo.releases.length === 0 ? (
            <Vazio texto="Novidades relevantes desta conta chegam toda semana." />
          ) : (
            <ul className="space-y-2.5">
              {alvo.releases.map((r) => (
                <li key={r.id} className="text-sm">
                  <p className="font-medium text-gray-800 flex items-center gap-1.5">
                    {r.titulo}
                    {r.url && (
                      <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-primary-500">
                        <ExternalLink size={12} />
                      </a>
                    )}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{r.relevancia}</p>
                </li>
              ))}
            </ul>
          )}
        </Bloco>
      </div>

      {/* Fontes / lineage */}
      {alvo.fontes?.length ? (
        <div className="mt-4 bg-gray-50 border border-gray-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1.5">
            Fontes verificadas <SaibaMais featureKey="mira.dossie.fontes" />
          </p>
          <ul className="space-y-1">
            {alvo.fontes.slice(0, 12).map((f, i) => (
              <li key={i} className="text-[11px] text-gray-400 truncate">
                <span className="text-gray-500 font-medium">{f.campo}:</span>{' '}
                <a href={f.url} target="_blank" rel="noopener noreferrer" className="hover:text-primary-500">
                  {f.url}
                </a>
                {f.data ? ` · ${new Date(f.data).toLocaleDateString('pt-BR')}` : ''}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/* Ações do Alvo: aprofundar com IA, pousar no CRM (Contact + Deal) e arquivar. */
function AlvoActions({
  alvo,
  onChange,
  onReload,
}: {
  alvo: MiraAlvoDossie;
  onChange: (patch: Partial<MiraAlvoDossie>) => void;
  onReload: () => void;
}) {
  const [sending, setSending] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [deepening, setDeepening] = useState(false);
  const [deepMsg, setDeepMsg] = useState<string | null>(null);
  const [mappingDec, setMappingDec] = useState(false);
  const [decMsg, setDecMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mapearDecisores = async () => {
    setMappingDec(true);
    setError(null);
    setDecMsg(null);
    try {
      const res = await miraApi.decisoresPublico(alvo.id);
      if (res.data.ok) {
        const total = res.data.criados + res.data.enriquecidos;
        setDecMsg(
          total > 0
            ? `${res.data.criados} decisor(es) novo(s) e ${res.data.enriquecidos} enriquecido(s) a partir de pegada pública.` +
                (res.data.descartadosPeloVerificador.length
                  ? ` O verificador descartou ${res.data.descartadosPeloVerificador.length} sem fonte.`
                  : '')
            : 'Nenhum decisor novo encontrado no índice público desta vez.'
        );
        onReload();
      } else {
        setError('O mapeamento não respondeu agora. Tente de novo em instantes.');
      }
    } catch (e: any) {
      if (e?.status === 501)
        setError('O provedor de busca ainda não está configurado nesta instalação (o time já foi avisado).');
      else setError(e?.message || 'O mapeamento de decisores falhou agora.');
    } finally {
      setMappingDec(false);
    }
  };

  const aprofundar = async () => {
    setDeepening(true);
    setError(null);
    setDeepMsg(null);
    try {
      const res = await miraApi.aprofundarAlvo(alvo.id);
      if (res.data.ok) {
        setDeepMsg(
          `Análise concluída: ${res.data.oportunidades} oportunidade(s) e ${res.data.roteiros} roteiro(s).` +
            (res.data.descartadosPeloVerificador.length
              ? ` O verificador descartou ${res.data.descartadosPeloVerificador.length} item(ns) sem lastro.`
              : '')
        );
        onReload();
      } else {
        setError('A análise não respondeu agora. Tente de novo em instantes.');
      }
    } catch (e: any) {
      if (e?.status === 412) setError('Cadastre o catálogo no Perfil de Prospecção antes de aprofundar.');
      else setError(e?.message || 'A análise falhou agora.');
    } finally {
      setDeepening(false);
    }
  };

  const pousar = async () => {
    setSending(true);
    setError(null);
    try {
      const res = await miraApi.pousarCrm(alvo.id);
      onChange({ status: 'DELIVERED', contactId: res.data.contactId, dealId: res.data.dealId });
    } catch (e: any) {
      setError(e?.message || 'Não foi possível enviar para o CRM agora.');
    } finally {
      setSending(false);
    }
  };

  const arquivar = async () => {
    setArchiving(true);
    setError(null);
    try {
      await miraApi.arquivarAlvo(alvo.id);
      onChange({ status: 'ARCHIVED' });
    } catch (e: any) {
      setError(e?.message || 'Não foi possível arquivar agora.');
    } finally {
      setArchiving(false);
    }
  };

  return (
    <div className="mt-4 border-t border-gray-100 pt-4 flex flex-wrap items-center gap-2.5">
      {alvo.status !== 'ARCHIVED' && (
        <button
          onClick={aprofundar}
          disabled={deepening}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-primary-200 text-primary-700 text-sm font-medium hover:bg-primary-50 disabled:opacity-60"
        >
          {deepening ? <Loader2 className="animate-spin" size={15} /> : <Sparkles size={15} />}
          {deepening ? 'Analisando…' : 'Aprofundar com IA'}
        </button>
      )}
      {alvo.status !== 'ARCHIVED' && <SaibaMais featureKey="mira.aprofundar" />}
      {alvo.status !== 'ARCHIVED' && (
        <button
          onClick={mapearDecisores}
          disabled={mappingDec}
          title="Mapeia decisores por cargo no LinkedIn e em páginas públicas (via índice de busca, sem login). Traz o responsável atual por cada área que você mapeou."
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-primary-200 text-primary-700 text-sm font-medium hover:bg-primary-50 disabled:opacity-60"
        >
          {mappingDec ? <Loader2 className="animate-spin" size={15} /> : <UserSearch size={15} />}
          {mappingDec ? 'Mapeando…' : 'Mapear decisores'}
        </button>
      )}
      {alvo.status !== 'ARCHIVED' && <SaibaMais featureKey="mira.decisores" />}
      {alvo.status === 'DELIVERED' && alvo.dealId ? (
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600">
          <CheckCircle2 size={15} /> No CRM
          <Link href="/crm" className="text-primary-600 hover:underline text-xs font-medium ml-1">
            abrir pipeline →
          </Link>
        </span>
      ) : alvo.status === 'READY' ? (
        <button
          onClick={pousar}
          disabled={sending}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-60"
        >
          {sending ? <Loader2 className="animate-spin" size={15} /> : <Send size={15} />}
          Enviar para o CRM
        </button>
      ) : alvo.status === 'ARCHIVED' ? (
        <span className="text-sm text-gray-400 font-medium">Alvo arquivado</span>
      ) : (
        <span className="text-xs text-gray-400 italic">Em qualificação: o Alvo pousa no CRM quando passar a verificação.</span>
      )}
      {alvo.status !== 'ARCHIVED' && alvo.status !== 'DELIVERED' && (
        <button
          onClick={arquivar}
          disabled={archiving}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-gray-200 text-gray-500 text-sm font-medium hover:bg-gray-50 disabled:opacity-60"
        >
          {archiving ? <Loader2 className="animate-spin" size={14} /> : <Archive size={14} />}
          Arquivar
        </button>
      )}
      {error && <span className="text-xs text-red-500">{error}</span>}
      {deepMsg && <span className="text-xs text-emerald-600">{deepMsg}</span>}
      {decMsg && <span className="text-xs text-emerald-600">{decMsg}</span>}
    </div>
  );
}

function ScoreRing({ label, value }: { label: string; value: number | null }) {
  const v = value ?? 0;
  return (
    <div className="text-right">
      <p className="text-2xl font-bold text-primary-700 leading-none">{value ?? '–'}</p>
      <p className="text-[10px] uppercase tracking-wide text-gray-400 mt-1">{label}</p>
    </div>
  );
}

function Bloco({
  icon: Icon,
  title,
  featureKey,
  children,
  full,
}: {
  icon: any;
  title: string;
  featureKey?: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={`bg-white border border-gray-200 rounded-xl p-5 ${full ? 'md:col-span-2' : ''}`}>
      <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-1.5">
        <Icon size={15} className="text-primary-500" />
        {title}
        {featureKey && <SaibaMais featureKey={featureKey} />}
      </h3>
      {children}
    </div>
  );
}

function Vazio({ texto }: { texto: string }) {
  return <p className="text-xs text-gray-400 italic">{texto}</p>;
}
