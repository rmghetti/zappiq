'use client';

/**
 * Mira Prospects — assistente de Nova campanha de prospecção.
 *
 * Nasceu do buraco de UX de 14/07: o cliente preenchia o Perfil e não achava
 * onde disparar a primeira campanha (os motores viviam escondidos em botões
 * na página de Alvos, e o hub mandava "aguardar"). Agora o disparo é um
 * assistente em dois passos (escolher o tipo, preencher e rodar), cada
 * disparo vira uma campanha NOMEADA e o resultado aponta para os Alvos dela.
 *
 * Usado pelo hub (passo 1 aberto) e pela página de Alvos (tipo pré-escolhido
 * pelos botões, direto no passo 2). "Campanha" aqui é de PROSPECÇÃO; não
 * confundir com as Campanhas do Zap Impulso (disparo de mensagens).
 */
import { useEffect, useState } from 'react';
import { ArrowLeft, Building2, Import, Loader2, Plus, Radar, Search, Sparkles, Store, X } from 'lucide-react';
import { regiaoViraUf } from '@zappiq/shared';
import { SaibaMais } from '@/components/shared/SaibaMais';
import { OQuePreencher } from '@/components/shared/OQuePreencher';
import {
  miraApi,
  formatBRL,
  type MiraCampanhaTipo,
  type MiraPackInfo,
  type MotorAResult,
  type MotorBResult,
} from '@/lib/miraApi';

/**
 * Lista de valores da campanha, nascida do Perfil. O cliente tira o que não
 * quer e soma o que faltar; o que sobra na tela é o que a busca usa. Chip que
 * veio do Perfil ganha selo, para ficar claro que a campanha considerou o que
 * ele já declarou (era exatamente a impressão que faltava).
 */
function ListaDeAlvos({
  label,
  ajuda,
  placeholder,
  campoKey,
  values,
  doPerfil,
  onChange,
}: {
  label: string;
  ajuda?: string;
  placeholder: string;
  /** Registro do "O que preencher aqui" deste campo. */
  campoKey: string;
  values: string[];
  doPerfil: Set<string>;
  onChange: (v: string[]) => void;
}) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = draft.trim();
    if (!v || values.includes(v)) return setDraft('');
    onChange([...values, v]);
    setDraft('');
  };
  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-1">
        <label className="block text-xs font-medium text-gray-500">{label}</label>
        <OQuePreencher campoKey={campoKey} />
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
          placeholder={placeholder}
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200"
        />
        <button
          type="button"
          onClick={add}
          className="px-3 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 shrink-0"
          aria-label={`Adicionar em ${label}`}
        >
          <Plus size={16} />
        </button>
      </div>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {values.map((v) => {
            const veioDoPerfil = doPerfil.has(v);
            return (
              <span
                key={v}
                className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
                  veioDoPerfil ? 'bg-primary-50 text-primary-700 ring-1 ring-primary-100' : 'bg-gray-100 text-gray-700'
                }`}
              >
                {veioDoPerfil && (
                  <Sparkles size={11} className="text-primary-500 shrink-0" aria-label="do seu Perfil" />
                )}
                {v}
                <button
                  type="button"
                  onClick={() => onChange(values.filter((x) => x !== v))}
                  className={veioDoPerfil ? 'text-primary-400 hover:text-primary-600' : 'text-gray-400 hover:text-gray-600'}
                  aria-label={`Remover ${v}`}
                >
                  <X size={12} />
                </button>
              </span>
            );
          })}
        </div>
      )}
      {ajuda && <p className="text-[11px] text-gray-400 mt-1.5">{ajuda}</p>}
    </div>
  );
}

export function NovaCampanhaModal({
  tipoInicial = null,
  onClose,
  onDone,
}: {
  /** Com tipo pré-escolhido, abre direto no passo 2 (botões da página de Alvos). */
  tipoInicial?: MiraCampanhaTipo | null;
  onClose: () => void;
  /** Fecha depois de rodar; com campanhaId dá para filtrar os Alvos criados. */
  onDone: (campanhaId?: string) => void;
}) {
  const [tipo, setTipo] = useState<MiraCampanhaTipo | null>(tipoInicial);
  const voltar = tipoInicial ? undefined : () => setTipo(null);

  if (!tipo) return <EscolherTipo onClose={onClose} onEscolher={setTipo} />;
  return tipo === 'BASE_INSTALADA' ? (
    <MapearCarteiraModal onClose={onClose} onDone={onDone} onVoltar={voltar} />
  ) : (
    <DescobrirModal onClose={onClose} onDone={onDone} onVoltar={voltar} />
  );
}

/* ── Passo 1: que tipo de campanha? ─────────────────────────────────── */
function EscolherTipo({ onClose, onEscolher }: { onClose: () => void; onEscolher: (t: MiraCampanhaTipo) => void }) {
  return (
    <ModalShell titulo="Nova campanha de prospecção" featureKey="mira.campanhas" onClose={onClose}>
      <div className="p-5">
        <p className="text-sm text-gray-500 mb-4">
          Uma campanha é um disparo dos agentes de mapeamento. Escolha por onde começar:
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onEscolher('DESCOBERTA')}
            className="text-left rounded-xl border border-gray-200 p-4 hover:border-primary-300 hover:bg-primary-50/40 transition-colors"
          >
            <Search size={20} className="text-primary-600" />
            <p className="text-sm font-semibold text-gray-900 mt-2">Descobrir novos clientes</p>
            <p className="text-xs text-gray-500 mt-1">
              Os agentes saem procurando empresas e negócios com a cara do seu Perfil de Prospecção. Você diz o
              que procurar; sem região digitada, vale a do Perfil.
            </p>
          </button>
          <button
            type="button"
            onClick={() => onEscolher('BASE_INSTALADA')}
            className="text-left rounded-xl border border-gray-200 p-4 hover:border-primary-300 hover:bg-primary-50/40 transition-colors"
          >
            <Radar size={20} className="text-primary-600" />
            <p className="text-sm font-semibold text-gray-900 mt-2">Mapear minha carteira</p>
            <p className="text-xs text-gray-500 mt-1">
              Cole CNPJs de clientes e contatos que você já tem. A Mira verifica cada um na fonte oficial, mapeia
              decisores e calcula o Mira Score.
            </p>
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

/* ── Casca comum dos modais ─────────────────────────────────────────── */
function ModalShell({
  titulo,
  icone,
  featureKey,
  onClose,
  onVoltar,
  children,
}: {
  titulo: string;
  icone?: React.ReactNode;
  featureKey?: string;
  onClose: () => void;
  onVoltar?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-1.5">
            {onVoltar && (
              <button onClick={onVoltar} className="text-gray-400 hover:text-gray-600 mr-1" aria-label="Voltar">
                <ArrowLeft size={16} />
              </button>
            )}
            {icone}
            {titulo}
            {featureKey && <SaibaMais featureKey={featureKey} />}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Campo de nome da campanha, comum aos dois tipos. */
function CampoNome({ nome, setNome, exemplo }: { nome: string; setNome: (v: string) => void; exemplo: string }) {
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between gap-2 mb-1">
        <label className="block text-xs font-medium text-gray-500">Nome da campanha (opcional)</label>
        <OQuePreencher campoKey="mira.campanha.nome" />
      </div>
      <input
        type="text"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        placeholder={exemplo}
        maxLength={120}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200"
      />
      <p className="text-[11px] text-gray-400 mt-1">Sem nome, batizamos pela busca e pela data.</p>
    </div>
  );
}

/** Rodapé do resultado: nome da campanha + ir para os Alvos dela. */
function ResultadoRodape({
  campanhaNome,
  onVerAlvos,
}: {
  campanhaNome?: string;
  onVerAlvos: () => void;
}) {
  return (
    <>
      {campanhaNome && (
        <p className="text-xs text-gray-500 mb-3">
          Campanha salva como <span className="font-medium text-gray-700">{campanhaNome}</span>. Ela fica na
          gestão do hub do Mira.
        </p>
      )}
      <button
        onClick={onVerAlvos}
        className="w-full px-4 py-2.5 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700"
      >
        Ver os Alvos desta campanha
      </button>
    </>
  );
}

/* ── Passo 2a: Mapear carteira (Motor A) ────────────────────────────── */
function MapearCarteiraModal({
  onClose,
  onDone,
  onVoltar,
}: {
  onClose: () => void;
  onDone: (campanhaId?: string) => void;
  onVoltar?: () => void;
}) {
  const [texto, setTexto] = useState('');
  const [nome, setNome] = useState('');
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
      const res = await miraApi.runMotorA(cnpjs, nome);
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
    <ModalShell
      titulo="Mapear carteira"
      icone={<Radar size={17} className="text-primary-600" />}
      featureKey="mira.motorA"
      onClose={onClose}
      onVoltar={onVoltar}
    >
      {!result ? (
        <div className="p-5">
          <p className="text-sm text-gray-500 mb-3">
            Cole os CNPJs da sua carteira (um por linha, até 50 por vez). A Mira enriquece cada conta na fonte
            oficial, mapeia os decisores do quadro societário e calcula o Mira Score. Só Alvos verificados
            descontam da cota.
          </p>
          <div className="flex items-center justify-between gap-2 mb-1">
            <label className="block text-xs font-medium text-gray-500">CNPJs da sua carteira</label>
            <OQuePreencher campoKey="mira.campanha.cnpjs" />
          </div>
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
          <CampoNome nome={nome} setNome={setNome} exemplo="Ex.: Clientes da carteira 2025" />
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
                <Radar size={15} /> Iniciar campanha
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
          <ResultadoRodape campanhaNome={result.campanhaNome} onVerAlvos={() => onDone(result.campanhaId)} />
        </div>
      )}
    </ModalShell>
  );
}

/* ── Passo 2b: Descobrir novos (Motor B / descoberta pública) ───────── */
function DescobrirModal({
  onClose,
  onDone,
  onVoltar,
}: {
  onClose: () => void;
  onDone: (campanhaId?: string) => void;
  onVoltar?: () => void;
}) {
  const [kind, setKind] = useState<'B2B' | 'B2C'>('B2B');
  const [alvos, setAlvos] = useState<string[]>([]);
  const [regioes, setRegioes] = useState<string[]>([]);
  // O que veio do Perfil, para marcar os chips e explicar a origem.
  const [doPerfil, setDoPerfil] = useState<{ alvos: Set<string>; regioes: Set<string> }>({
    alvos: new Set(),
    regioes: new Set(),
  });
  const [semente, setSemente] = useState<'perfil' | 'vazio' | null>(null);
  const [nome, setNome] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<MotorBResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fontes, setFontes] = useState<{
    places: boolean;
    buscaPublica: boolean;
    provider: string | null;
    cnpjIndexDisponivel: boolean;
    cnpjIndexTotal: number;
    bigquery?: boolean;
  } | null>(null);

  useEffect(() => {
    miraApi
      .motorBStatus()
      .then((r) => setFontes(r.data))
      .catch(() => setFontes(null));
  }, []);

  // A campanha nasce com o que o cliente já declarou no Perfil. Trocar de
  // trilha (B2B/B2C) recarrega a semente, porque cada caminho tem os seus
  // alvos e as suas regiões.
  useEffect(() => {
    let alive = true;
    setSemente(null);
    miraApi
      .sementeCampanha(kind)
      .then((r) => {
        if (!alive) return;
        setAlvos(r.data.alvos);
        setRegioes(r.data.regioes);
        setDoPerfil({ alvos: new Set(r.data.alvos), regioes: new Set(r.data.regioes) });
        setSemente(r.data.origem);
      })
      .catch(() => alive && setSemente('vazio'));
    return () => {
      alive = false;
    };
  }, [kind]);

  // B2B funciona com QUALQUER uma das duas fontes: índice local (grátis,
  // sem chave, precisa da ingestão da base da Receita) ou busca pública.
  const fonteOk = fontes
    ? kind === 'B2C'
      ? fontes.places
      : fontes.bigquery || fontes.cnpjIndexDisponivel || fontes.buscaPublica
    : null;

  const descobrir = async () => {
    if (alvos.length === 0) {
      setError('Escolha ao menos um alvo. Sem isso a busca não sabe o que procurar.');
      return;
    }
    setRunning(true);
    setError(null);
    try {
      const res = await miraApi.descobrir(alvos, regioes, kind, nome);
      setResult(res.data);
    } catch (e: any) {
      if (e?.status === 422) setError(e?.message || 'Nenhum dos alvos escolhidos pode ser buscado agora.');
      else if (e?.status === 501)
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
    <ModalShell
      titulo="Descobrir novos"
      icone={<Search size={17} className="text-primary-600" />}
      featureKey="mira.motorB"
      onClose={onClose}
      onVoltar={onVoltar}
    >
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
              ? 'A Mira descobre empresas com o perfil que você descrever, colhe os CNPJs e verifica cada um na Receita. Só vira Alvo quem está ativo e tem ao menos um decisor no registro: empresa que a busca acha mas não tem quem abordar não sobe, para a sua fila não encher de conta sem dono.'
              : 'A Mira busca negócios locais com o perfil que você descrever (Google Places). Só Alvos com contato verificável (telefone ou site) descontam da cota.'}
          </p>
          {semente === null ? (
            <div className="flex items-center gap-2 text-xs text-gray-400 py-6">
              <Loader2 className="animate-spin" size={14} /> Trazendo o que você definiu no Perfil…
            </div>
          ) : (
            <>
              {semente === 'perfil' && (
                <p className="text-xs text-primary-800 bg-primary-50/60 border border-primary-100 rounded-lg px-3 py-2 mb-3">
                  <Sparkles size={12} className="inline-block mr-1 -mt-0.5 text-primary-500" />
                  Trouxemos o que você definiu no Perfil de Prospecção. Tire o que não quiser nesta campanha ou
                  acrescente outros.
                </p>
              )}
              {semente === 'vazio' && (
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-3">
                  Seu Perfil ainda não declarou{' '}
                  {kind === 'B2B' ? 'CNAEs ou atividades-alvo nem regiões' : 'a região do seu público'}, então esta
                  campanha começa vazia. O que você escolher aqui vale só para ela.
                </p>
              )}
              {kind === 'B2C' && (
                <p className="text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 mb-3">
                  O tipo de negócio a procurar você define aqui: o bloco B2C do Perfil descreve o seu consumidor
                  (idade, renda, interesses), não o tipo de negócio local. A região, essa sim, vem do Perfil.
                </p>
              )}
              <div className="space-y-3">
                <ListaDeAlvos
                  label="O que procurar"
                  campoKey={kind === 'B2B' ? 'mira.campanha.alvos.b2b' : 'mira.campanha.alvos.b2c'}
                  placeholder={kind === 'B2B' ? 'Ex.: 4651-6 ou "distribuidoras de TI"' : 'Ex.: clínicas de estética, academias'}
                  ajuda={
                    kind === 'B2B'
                      ? 'Código de CNAE busca na base oficial de CNPJs; atividade escrita vira CNAE e busca lá também.'
                      : undefined
                  }
                  values={alvos}
                  doPerfil={doPerfil.alvos}
                  onChange={setAlvos}
                />
                <ListaDeAlvos
                  label="Onde (opcional)"
                  campoKey={kind === 'B2B' ? 'mira.campanha.regiao.b2b' : 'mira.campanha.regiao.b2c'}
                  // O B2B recorta por UF (a base filtra sigla_uf), então sugerir
                  // "Campinas" aqui ensinava a errar: cidade sozinha não recorta
                  // nada e a busca ia para o Brasil inteiro calada.
                  placeholder={kind === 'B2B' ? 'Ex.: SP, RJ, Minas Gerais…' : 'Ex.: Campinas, Moema, zona sul de SP…'}
                  ajuda={
                    kind === 'B2B'
                      ? 'A busca por empresas recorta por estado. Sem estado, ela vale para o Brasil inteiro.'
                      : 'Cidade ou bairro. Sem região, a busca não tem recorte geográfico.'
                  }
                  values={regioes}
                  doPerfil={doPerfil.regioes}
                  onChange={setRegioes}
                />
                {kind === 'B2B' && regioes.length > 0 && regioes.every((r) => !regiaoViraUf(r)) && (
                  <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                    Nenhuma das regiões escolhidas tem um estado, então esta campanha vai procurar no Brasil
                    inteiro. Para recortar, escreva a sigla ({regioes[0]}, SP) ou o estado por extenso.
                  </p>
                )}
              </div>
            </>
          )}
          <CampoNome nome={nome} setNome={setNome} exemplo="Ex.: Clínicas de Campinas" />
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
            disabled={running || fonteOk === false || alvos.length === 0}
            className="w-full mt-4 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-60"
          >
            {running ? (
              <>
                <Loader2 className="animate-spin" size={15} /> Descobrindo…
              </>
            ) : (
              <>
                <Search size={15} /> Iniciar campanha
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
            {result.regiaoAplicada && <li>Região aplicada: {result.regiaoAplicada}.</li>}
            {result.duplicados > 0 && <li>{result.duplicados} já estavam mapeados (pulados).</li>}
            {/* O filtro precisa APARECER. Desde 15/07/2026 o Alvo sem decisor
                não sobe, e sem esta linha a campanha mostraria 3 onde antes
                mostrava 14, sem explicação. O cliente leria "o Mira parou de
                achar" — exatamente a visão negativa que o filtro existe para
                evitar, só que em roupa nova. */}
            {(result.descartadosCrus ?? 0) > 0 && (
              <li className="text-amber-700">
                {result.descartadosCrus} empresa(s) verificada(s) na Receita não subiram: sem nenhum decisor no
                registro, o dossiê nasceria vazio.
              </li>
            )}
            {(result.descartadosSoNome ?? 0) > 0 && (
              <li className="text-amber-700">
                {result.descartadosSoNome} apareceram na busca só com o nome (sem CNPJ) e não viraram Alvo.
              </li>
            )}
            {(result.descartadosPorPorte ?? 0) > 0 && (
              <li className="text-amber-700">
                {result.descartadosPorPorte} empresa(s) de porte fora do que você pediu não entraram (a Receita não
                publica faturamento; o recorte usa porte e capital, uma aproximação de tamanho). Não gastam cota.
              </li>
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
          <ResultadoRodape campanhaNome={result.campanhaNome} onVerAlvos={() => onDone(result.campanhaId)} />
        </div>
      )}
    </ModalShell>
  );
}

/* Botões de compra de pack avulso (one-shot, +20%), quando a cota do mês esgota. */
export function ComprarPacks() {
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
