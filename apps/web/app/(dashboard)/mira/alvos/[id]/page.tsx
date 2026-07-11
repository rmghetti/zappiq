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
} from 'lucide-react';
import { SaibaMais } from '@/components/shared/SaibaMais';
import { miraApi, type MiraAlvoDossie } from '@/lib/miraApi';

export default function MiraAlvoDossiePage() {
  const params = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [alvo, setAlvo] = useState<MiraAlvoDossie | null>(null);
  const [notFound, setNotFound] = useState(false);

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
  }, [params?.id]);

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

        {/* Por que essa nota (score breakdown) */}
        {alvo.scoreBreakdown?.fatores?.length ? (
          <div className="mt-4 border-t border-gray-100 pt-3">
            <p className="text-xs font-semibold text-gray-500 mb-2">Por que essa nota</p>
            <div className="space-y-1.5">
              {alvo.scoreBreakdown.fatores.map((f) => (
                <div key={f.nome} className="flex items-center gap-3 text-xs">
                  <span className="w-40 text-gray-500 shrink-0">{f.nome}</span>
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary-400 rounded-full"
                      style={{ width: `${Math.min(100, Math.round((f.valor / Math.max(1, f.peso)) * 100))}%` }}
                    />
                  </div>
                  <span className="w-12 text-right font-medium text-gray-600 shrink-0">
                    {f.valor}/{f.peso}
                  </span>
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
