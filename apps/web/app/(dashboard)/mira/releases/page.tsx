'use client';

/**
 * Mira Prospects — Releases dos Alvos (/(dashboard)/mira/releases)
 *
 * Vigilância semanal das contas mapeadas: os agentes varrem os Alvos
 * e trazem só o que é RELEVANTE para as ofertas do cliente, com o
 * motivo e o gancho de abordagem. Alimentado por cron semanal.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Newspaper, Loader2, ArrowLeft, ExternalLink, Check, Target } from 'lucide-react';
import { SaibaMais } from '@/components/shared/SaibaMais';
import { miraApi, type MiraReleaseItem } from '@/lib/miraApi';

export default function MiraReleasesPage() {
  const [loading, setLoading] = useState(true);
  const [releases, setReleases] = useState<MiraReleaseItem[]>([]);
  const [unreadOnly, setUnreadOnly] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    miraApi
      .listReleases(unreadOnly)
      .then((res) => alive && setReleases(res.data))
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [unreadOnly]);

  const markLida = async (id: string) => {
    setReleases((rs) => rs.map((r) => (r.id === id ? { ...r, lida: true } : r)));
    try {
      await miraApi.markReleaseLida(id);
    } catch {
      /* otimista; recarrega no próximo fetch */
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Link href="/mira" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 mb-4">
        <ArrowLeft size={14} /> Mira Prospects
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center">
            <Newspaper className="text-primary-600" size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-1.5">
              Releases dos Alvos
              <SaibaMais featureKey="mira.releases" />
            </h1>
            <p className="text-sm text-gray-500">
              Novidades das suas contas mapeadas, com o motivo de importar e o gancho de abordagem.
            </p>
          </div>
        </div>
        <button
          onClick={() => setUnreadOnly((v) => !v)}
          className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${
            unreadOnly ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          Só não lidos
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <Loader2 className="animate-spin" size={24} />
        </div>
      ) : releases.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-gray-200 rounded-xl">
          <Newspaper className="mx-auto text-gray-300 mb-3" size={40} />
          <p className="text-gray-500 font-medium">Nenhuma novidade por enquanto</p>
          <p className="text-sm text-gray-400 mt-1 max-w-md mx-auto">
            Toda semana os agentes varrem os seus Alvos. Quando uma conta publicar algo relevante para as
            suas ofertas, aparece aqui com o gancho de abordagem.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {releases.map((r) => (
            <div
              key={r.id}
              className={`bg-white border rounded-xl p-4 ${r.lida ? 'border-gray-100 opacity-70' : 'border-gray-200'}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  {r.alvo && (
                    <Link
                      href={`/mira/alvos/${r.alvo.id}`}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary-600 hover:underline mb-1"
                    >
                      <Target size={11} /> {r.alvo.nome}
                    </Link>
                  )}
                  <p className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                    {r.titulo}
                    {r.url && (
                      <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-gray-300 hover:text-primary-500">
                        <ExternalLink size={13} />
                      </a>
                    )}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{r.resumo}</p>
                </div>
                {!r.lida && (
                  <button
                    onClick={() => markLida(r.id)}
                    className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-gray-400 hover:text-emerald-600 border border-gray-200 hover:border-emerald-200 rounded-lg px-2.5 py-1.5"
                    title="Marcar como lida"
                  >
                    <Check size={13} /> Lida
                  </button>
                )}
              </div>
              <div className="mt-3 bg-primary-50/60 border border-primary-100 rounded-lg px-3 py-2.5">
                <p className="text-xs text-primary-900">
                  <span className="font-semibold">Por que importa:</span> {r.relevancia}
                </p>
                {r.anguloAbordagem && (
                  <p className="text-xs text-primary-800 mt-1">
                    <span className="font-semibold">Gancho:</span> {r.anguloAbordagem}
                  </p>
                )}
                {r.produtoRelacionado && (
                  <p className="text-[11px] text-primary-600 mt-1">Oferta com sinergia: {r.produtoRelacionado}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
