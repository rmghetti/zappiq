'use client';

/**
 * Mira Prospects — Alvos (/(dashboard)/mira/alvos)
 * A fila de prospecção: Alvos priorizados pelo Mira Score. Cada linha
 * abre o dossiê. Filtros por status/motor + busca.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Target,
  Loader2,
  Search,
  ArrowLeft,
  Building2,
  Store,
  Users,
  Newspaper,
  Radar,
  X,
} from 'lucide-react';
import { SaibaMais } from '@/components/shared/SaibaMais';
import { NovaCampanhaModal, ComprarPacks } from '@/components/mira/NovaCampanhaModal';
import { miraApi, type MiraAlvoListItem, type MiraQuota, type MiraCampanhaTipo } from '@/lib/miraApi';

const STATUS_FILTERS = [
  { key: '', label: 'Todos' },
  { key: 'READY', label: 'Prontos' },
  { key: 'QUALIFYING', label: 'Em qualificação' },
  { key: 'DELIVERED', label: 'Entregues' },
] as const;

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  DISCOVERED: { label: 'Descoberto', cls: 'bg-gray-100 text-gray-600' },
  QUALIFYING: { label: 'Em qualificação', cls: 'bg-amber-50 text-amber-600' },
  READY: { label: 'Pronto', cls: 'bg-emerald-50 text-emerald-600' },
  DELIVERED: { label: 'Entregue', cls: 'bg-primary-50 text-primary-600' },
  ARCHIVED: { label: 'Arquivado', cls: 'bg-gray-100 text-gray-400' },
};

export default function MiraAlvosPage() {
  const [loading, setLoading] = useState(true);
  const [alvos, setAlvos] = useState<MiraAlvoListItem[]>([]);
  const [quota, setQuota] = useState<MiraQuota | null>(null);
  const [status, setStatus] = useState<string>('');
  const [q, setQ] = useState('');
  const [novaCampanha, setNovaCampanha] = useState<MiraCampanhaTipo | null>(null);
  const [campanhaFiltro, setCampanhaFiltro] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Chegou por link "ver alvos desta campanha" (hub)? Aplica o filtro.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('campanha');
    if (id) setCampanhaFiltro(id);
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const t = setTimeout(() => {
      miraApi
        .listAlvos({ status: status || undefined, q: q || undefined, campanhaId: campanhaFiltro || undefined })
        .then((res) => {
          if (!alive) return;
          setAlvos(res.data.alvos);
          setQuota(res.data.quota);
        })
        .catch(() => {})
        .finally(() => alive && setLoading(false));
    }, q ? 300 : 0);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [status, q, reloadKey, campanhaFiltro]);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <Link href="/mira" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 mb-4">
        <ArrowLeft size={14} /> Mira Prospects
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center">
            <Target className="text-primary-600" size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-1.5">
              Alvos
              <SaibaMais featureKey="mira.alvos" />
            </h1>
            <p className="text-sm text-gray-500">A fila de prospecção, priorizada pelo Mira Score.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {quota && (
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${quota.blocked ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-600'}`}>
              {quota.used}/{quota.total} no mês
            </span>
          )}
          <button
            onClick={() => setNovaCampanha('DESCOBERTA')}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-primary-200 text-primary-700 text-sm font-medium hover:bg-primary-50"
          >
            <Search size={15} /> Descobrir novos
          </button>
          <button
            onClick={() => setNovaCampanha('BASE_INSTALADA')}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700"
          >
            <Radar size={15} /> Mapear carteira
          </button>
        </div>
      </div>

      {novaCampanha && (
        <NovaCampanhaModal
          tipoInicial={novaCampanha}
          onClose={() => setNovaCampanha(null)}
          onDone={(campanhaId) => {
            setNovaCampanha(null);
            setCampanhaFiltro(campanhaId ?? null);
            setReloadKey((k) => k + 1);
          }}
        />
      )}

      {quota?.blocked && (
        <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 mb-5">
          <p className="text-sm text-red-600 font-medium">
            Cota do mês esgotada ({quota.used}/{quota.total}). Compre um pacote avulso para continuar mapeando agora, ou aguarde a virada do mês.
          </p>
          <ComprarPacks />
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        {campanhaFiltro && (
          <button
            onClick={() => setCampanhaFiltro(null)}
            className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full text-sm font-medium bg-primary-50 text-primary-700 border border-primary-200 hover:bg-primary-100"
            title="Mostrando só os Alvos desta campanha. Clique para limpar."
          >
            Desta campanha <X size={13} />
          </button>
        )}
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setStatus(f.key)}
            className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${
              status === f.key
                ? 'bg-primary-600 text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {f.label}
          </button>
        ))}
        <div className="relative ml-auto">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nome ou CNPJ…"
            className="pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm w-64 focus:outline-none focus:ring-2 focus:ring-primary-200"
          />
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <Loader2 className="animate-spin" size={24} />
        </div>
      ) : alvos.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-gray-200 rounded-xl">
          <Target className="mx-auto text-gray-300 mb-3" size={40} />
          <p className="text-gray-500 font-medium">Nenhum Alvo por aqui ainda</p>
          <p className="text-sm text-gray-400 mt-1 max-w-md mx-auto">
            Complete o Perfil de Prospecção e os agentes começam a mapear o seu mercado. Os Alvos aparecem
            aqui, priorizados pelo Mira Score.
          </p>
          <Link
            href="/mira/perfil"
            className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700"
          >
            Ir para o Perfil
          </Link>
        </div>
      ) : (
        <div className="space-y-2.5">
          {alvos.map((a) => {
            const badge = STATUS_BADGE[a.status] ?? STATUS_BADGE.DISCOVERED;
            return (
              <Link
                key={a.id}
                href={`/mira/alvos/${a.id}`}
                className="flex items-center gap-4 bg-white border border-gray-200 rounded-xl px-4 py-3.5 hover:border-primary-300 hover:shadow-sm transition-all"
              >
                {/* Score */}
                <div className="w-12 h-12 rounded-xl bg-primary-50 flex flex-col items-center justify-center shrink-0">
                  <span className="text-base font-bold text-primary-700 leading-none">
                    {a.miraScore ?? '–'}
                  </span>
                  <span className="text-[9px] uppercase tracking-wide text-primary-400 mt-0.5">score</span>
                </div>
                {/* Nome + meta */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {a.kind === 'B2B' ? (
                      <Building2 size={13} className="text-gray-400 shrink-0" />
                    ) : (
                      <Store size={13} className="text-gray-400 shrink-0" />
                    )}
                    <p className="font-medium text-gray-900 truncate">{a.nomeFantasia || a.nome}</p>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${badge.cls}`}>
                      {badge.label}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 truncate mt-0.5">
                    {[
                      [a.municipio, a.uf].filter(Boolean).join('/'),
                      a.porte,
                      a.cnae ? `CNAE ${a.cnae}` : null,
                      a.motor === 'BASE_INSTALADA' ? 'Base instalada' : 'Descoberta',
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                {/* Contadores */}
                <div className="hidden sm:flex items-center gap-4 text-xs text-gray-400 shrink-0">
                  <span className="inline-flex items-center gap-1">
                    <Users size={13} /> {a._count.decisores}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Newspaper size={13} /> {a._count.releases}
                  </span>
                  {a.confianca !== null && (
                    <span
                      className={`font-semibold ${a.confianca >= 70 ? 'text-emerald-500' : a.confianca >= 40 ? 'text-amber-500' : 'text-gray-400'}`}
                    >
                      {a.confianca}% conf.
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
