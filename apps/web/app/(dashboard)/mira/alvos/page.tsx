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
  Import,
} from 'lucide-react';
import { SaibaMais } from '@/components/shared/SaibaMais';
import { miraApi, formatBRL, type MiraAlvoListItem, type MiraQuota, type MotorAResult, type MotorBResult, type MiraPackInfo } from '@/lib/miraApi';

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
  const [showMapear, setShowMapear] = useState(false);
  const [showDescobrir, setShowDescobrir] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const t = setTimeout(() => {
      miraApi
        .listAlvos({ status: status || undefined, q: q || undefined })
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
  }, [status, q, reloadKey]);

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
            onClick={() => setShowDescobrir(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-primary-200 text-primary-700 text-sm font-medium hover:bg-primary-50"
          >
            <Search size={15} /> Descobrir novos
          </button>
          <button
            onClick={() => setShowMapear(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700"
          >
            <Radar size={15} /> Mapear carteira
          </button>
        </div>
      </div>

      {showMapear && (
        <MapearCarteiraModal
          onClose={() => setShowMapear(false)}
          onDone={() => {
            setShowMapear(false);
            setReloadKey((k) => k + 1);
          }}
        />
      )}
      {showDescobrir && (
        <DescobrirModal
          onClose={() => setShowDescobrir(false)}
          onDone={() => {
            setShowDescobrir(false);
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

/* ── Modal: Mapear carteira (Motor A) ────────────────────────────── */
function MapearCarteiraModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [texto, setTexto] = useState('');
  const [running, setRunning] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<MotorAResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const parseCnpjs = (t: string) =>
    t
      .split(/[\n;,]+/)
      .map((s) => s.trim())
      .filter((s) => s.replace(/\D/g, '').length >= 11)
      .slice(0, 50);

  const importarDoCrm = async () => {
    setImporting(true);
    setError(null);
    try {
      const res = await miraApi.crmCandidates();
      if (res.data.cnpjs.length === 0) {
        setError('Nenhum CNPJ encontrado nos contatos do CRM (campo personalizado "cnpj").');
      } else {
        setTexto((prev) => [prev.trim(), ...res.data.cnpjs].filter(Boolean).join('\n'));
      }
    } catch (e: any) {
      setError(e?.message || 'Não foi possível ler o CRM agora.');
    } finally {
      setImporting(false);
    }
  };

  const mapear = async () => {
    const cnpjs = parseCnpjs(texto);
    if (cnpjs.length === 0) {
      setError('Cole ao menos um CNPJ válido (14 dígitos), um por linha.');
      return;
    }
    setRunning(true);
    setError(null);
    try {
      const res = await miraApi.runMotorA(cnpjs);
      setResult(res.data);
    } catch (e: any) {
      if (e?.status === 412) {
        setError('Complete o Perfil de Prospecção (mínimo 60%) antes de mapear. Vá em Mira Prospects > Perfil.');
      } else {
        setError(e?.message || 'O mapeamento falhou. Tente novamente.');
      }
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-1.5">
            <Radar size={17} className="text-primary-600" /> Mapear carteira
            <SaibaMais featureKey="mira.motorA" />
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        {!result ? (
          <div className="p-5">
            <p className="text-sm text-gray-500 mb-3">
              Cole os CNPJs da sua carteira (um por linha, até 50 por vez). A Mira enriquece cada conta na
              fonte oficial, mapeia os decisores do quadro societário e calcula o Mira Score. Só Alvos
              verificados descontam da cota.
            </p>
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder={'12.345.678/0001-90\n98.765.432/0001-10'}
              rows={7}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-200"
            />
            <div className="flex items-center justify-between mt-2">
              <button
                onClick={importarDoCrm}
                disabled={importing}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-primary-600 hover:underline disabled:opacity-50"
              >
                {importing ? <Loader2 className="animate-spin" size={13} /> : <Import size={13} />}
                Importar CNPJs do meu CRM
              </button>
              <span className="text-xs text-gray-400">{parseCnpjs(texto).length}/50</span>
            </div>
            {error && <p className="text-xs text-red-500 mt-3">{error}</p>}
            <button
              onClick={mapear}
              disabled={running}
              className="w-full mt-4 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-60"
            >
              {running ? (
                <>
                  <Loader2 className="animate-spin" size={15} /> Mapeando (fonte oficial)…
                </>
              ) : (
                <>
                  <Radar size={15} /> Mapear agora
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="p-5">
            <div className="grid grid-cols-3 gap-2 mb-4">
              <ResultStat label="Prontos" value={result.prontos} tone="emerald" />
              <ResultStat label="Criados" value={result.criados} tone="primary" />
              <ResultStat label="Restante da cota" value={result.quota.remaining} tone="gray" />
            </div>
            <ul className="text-xs text-gray-500 space-y-1 mb-4">
              {result.duplicados.length > 0 && <li>{result.duplicados.length} já estavam mapeados (pulados).</li>}
              {result.inativos.length > 0 && <li>{result.inativos.length} inativos na Receita (não gastam cota).</li>}
              {result.naoEncontrados.length > 0 && <li>{result.naoEncontrados.length} não encontrados na fonte.</li>}
              {result.invalidos.length > 0 && <li>{result.invalidos.length} CNPJs inválidos.</li>}
              {result.erros.length > 0 && <li>{result.erros.length} com erro de fonte (tente de novo mais tarde).</li>}
            </ul>
            {result.blocked && (
              <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2.5 mb-4">
                <p className="text-xs text-red-600">
                  Sua cota do mês esgotou{result.naoProcessados.length > 0 ? ` (${result.naoProcessados.length} CNPJs ficaram na fila)` : ''}.
                  Compre um pacote avulso para continuar agora, ou aguarde a virada do mês.
                </p>
                <ComprarPacks />
              </div>
            )}
            <button
              onClick={onDone}
              className="w-full px-4 py-2.5 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700"
            >
              Ver os Alvos
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Modal: Descobrir novos (Motor B) ────────────────────────────── */
function DescobrirModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [kind, setKind] = useState<'B2B' | 'B2C'>('B2B');
  const [consulta, setConsulta] = useState('');
  const [regiao, setRegiao] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<MotorBResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fontes, setFontes] = useState<{
    places: boolean;
    buscaPublica: boolean;
    provider: string | null;
    cnpjIndexDisponivel: boolean;
    cnpjIndexTotal: number;
  } | null>(null);

  useEffect(() => {
    miraApi
      .motorBStatus()
      .then((r) => setFontes(r.data))
      .catch(() => setFontes(null));
  }, []);

  // B2B funciona com QUALQUER uma das duas fontes: índice local (grátis,
  // sem chave, precisa da ingestão da base da Receita) ou busca pública.
  const fonteOk = fontes ? (kind === 'B2C' ? fontes.places : fontes.buscaPublica || fontes.cnpjIndexDisponivel) : null;

  const descobrir = async () => {
    if (consulta.trim().length < 3) {
      setError('Descreva o que procurar (ex.: "clínicas de estética").');
      return;
    }
    setRunning(true);
    setError(null);
    try {
      const res = await miraApi.descobrir(consulta.trim(), regiao.trim() || undefined, kind);
      setResult(res.data);
    } catch (e: any) {
      if (e?.status === 501)
        setError(
          kind === 'B2C'
            ? 'A descoberta local (Google Places) ainda não está habilitada nesta instalação.'
            : 'A descoberta B2B precisa de um provedor de busca configurado (ex.: Google Programmable Search, grátis).'
        );
      else if (e?.status === 412) setError('Complete o Perfil de Prospecção (mínimo 60%) antes de descobrir.');
      else setError(e?.message || 'A descoberta falhou agora. Tente novamente.');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-1.5">
            <Search size={17} className="text-primary-600" /> Descobrir novos
            <SaibaMais featureKey="mira.motorB" />
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        {!result ? (
          <div className="p-5">
            {/* Trilha B2B (empresa) x B2C (negócio local) */}
            <div className="flex gap-2 mb-3">
              {(['B2B', 'B2C'] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setKind(k)}
                  className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    kind === k ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {k === 'B2B' ? <Building2 size={14} /> : <Store size={14} />}
                  {k === 'B2B' ? 'Empresas (B2B)' : 'Negócio local (B2C)'}
                </button>
              ))}
            </div>

            <p className="text-sm text-gray-500 mb-3">
              {kind === 'B2B'
                ? 'A Mira descobre empresas com o perfil que você descrever no índice público, colhe os CNPJs e verifica cada um na Receita. Só o Alvo verificado (ativo, com decisor no quadro societário) desconta da cota; os demais ficam como candidatos.'
                : 'A Mira busca negócios locais com o perfil que você descrever (Google Places). Só Alvos com contato verificável (telefone ou site) descontam da cota.'}
            </p>
            <label className="block text-xs font-medium text-gray-500 mb-1">O que procurar</label>
            <input
              type="text"
              value={consulta}
              onChange={(e) => setConsulta(e.target.value)}
              placeholder={kind === 'B2B' ? 'Ex.: "distribuidoras de bebidas", "indústrias metalúrgicas"' : 'Ex.: "clínicas de estética", "academias"'}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200 mb-3"
            />
            <label className="block text-xs font-medium text-gray-500 mb-1">Onde (opcional)</label>
            <input
              type="text"
              value={regiao}
              onChange={(e) => setRegiao(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && descobrir()}
              placeholder="Ex.: Campinas, zona sul de SP…"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200"
            />
            {fonteOk === false && (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mt-3">
                {kind === 'B2B'
                  ? 'A descoberta B2B ainda não está habilitada nesta instalação: falta ingerir a base local de CNPJ (grátis) OU configurar um provedor de busca (ex.: Google Programmable Search, grátis).'
                  : 'A descoberta local (Google Places) ainda não está habilitada nesta instalação.'}
              </p>
            )}
            {error && <p className="text-xs text-red-500 mt-3">{error}</p>}
            <button
              onClick={descobrir}
              disabled={running || fonteOk === false}
              className="w-full mt-4 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-60"
            >
              {running ? (
                <>
                  <Loader2 className="animate-spin" size={15} /> Descobrindo…
                </>
              ) : (
                <>
                  <Search size={15} /> Descobrir agora
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="p-5">
            <div className="grid grid-cols-3 gap-2 mb-4">
              <ResultStat
                label={result.modo === 'B2C' ? 'Encontrados' : 'Verificados'}
                value={result.modo === 'B2C' ? result.encontrados : result.cnpjsVerificados ?? 0}
                tone="gray"
              />
              <ResultStat label="Prontos" value={result.prontos} tone="emerald" />
              <ResultStat label="Restante da cota" value={result.quota.remaining} tone="primary" />
            </div>
            <ul className="text-xs text-gray-500 space-y-1 mb-4">
              {result.duplicados > 0 && <li>{result.duplicados} já estavam mapeados (pulados).</li>}
              {result.modo !== 'B2C' && (result.candidatos ?? 0) > 0 && (
                <li>{result.candidatos} candidato(s) sem CNPJ resolvido ficaram para qualificar (não gastam cota).</li>
              )}
              {result.modo === 'B2C' && result.criados - result.prontos > 0 && (
                <li>{result.criados - result.prontos} sem contato verificável ficaram em qualificação (não gastam cota).</li>
              )}
            </ul>
            {result.blocked && (
              <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2.5 mb-4">
                <p className="text-xs text-red-600">
                  Sua cota do mês esgotou. Compre um pacote avulso para continuar agora, ou aguarde a virada do mês.
                </p>
                <ComprarPacks />
              </div>
            )}
            <button
              onClick={onDone}
              className="w-full px-4 py-2.5 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700"
            >
              Ver os Alvos
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* Botões de compra de pack avulso (one-shot, +20%), quando a cota do mês esgota. */
function ComprarPacks() {
  const [packs, setPacks] = useState<MiraPackInfo[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    miraApi
      .access()
      .then((r) => alive && setPacks(r.data.catalog?.packs ?? []))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const comprar = async (key: string) => {
    setBusy(key);
    setErr(null);
    try {
      const r = await miraApi.packCheckout(key);
      if (r.url) window.location.href = r.url;
      else setErr('Não consegui abrir o checkout agora.');
    } catch (e: any) {
      if (e?.status === 503) setErr('O pagamento ainda não está configurado nesta instalação.');
      else setErr(e?.message || 'Falha ao abrir o checkout.');
      setBusy(null);
    }
  };

  if (packs.length === 0) return null;
  return (
    <div className="mt-2.5">
      <div className="grid grid-cols-3 gap-2">
        {packs.map((p) => (
          <button
            key={p.key}
            onClick={() => comprar(p.key)}
            disabled={busy !== null}
            className="border border-primary-200 bg-white rounded-lg px-2 py-2 text-center hover:bg-primary-50 disabled:opacity-60"
          >
            <p className="text-sm font-bold text-primary-700 leading-none">
              {busy === p.key ? '…' : `+${p.alvos}`}
            </p>
            <p className="text-[11px] text-gray-500 mt-1">{formatBRL(p.price)}</p>
          </button>
        ))}
      </div>
      {err && <p className="text-[11px] text-red-500 mt-1.5">{err}</p>}
    </div>
  );
}

function ResultStat({ label, value, tone }: { label: string; value: number; tone: 'emerald' | 'primary' | 'gray' }) {
  const cls =
    tone === 'emerald' ? 'bg-emerald-50 text-emerald-700' : tone === 'primary' ? 'bg-primary-50 text-primary-700' : 'bg-gray-50 text-gray-600';
  return (
    <div className={`rounded-lg px-3 py-2.5 text-center ${cls}`}>
      <p className="text-lg font-bold leading-none">{value}</p>
      <p className="text-[10px] uppercase tracking-wide mt-1 opacity-80">{label}</p>
    </div>
  );
}
