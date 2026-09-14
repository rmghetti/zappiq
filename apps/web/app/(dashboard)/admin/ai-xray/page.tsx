'use client';

/* ══════════════════════════════════════════════════════════════════════
 * /admin/ai-xray: Raio-X do que a IA recebe.
 * --------------------------------------------------------------------
 * Tarefa A3. Escolha a organização, o canal e escreva o que o cliente
 * final diria. A tela mostra, por turno:
 *
 *   - o tamanho do prompt em caracteres
 *   - as checagens em verde e vermelho, com o trecho procurado em cada uma
 *   - as fontes que a base devolveu, com a similaridade
 *   - o prompt inteiro, fatiado em blocos que abrem e fecham
 *
 * Nenhum modelo é chamado. Rodar o Raio-X custa zero e pode ser repetido
 * à vontade, inclusive na organização de um cliente que acabou de
 * reclamar que "a IA não faz o que eu configurei".
 *
 * Só SUPERADMIN: a tela mostra o prompt inteiro de qualquer organização.
 * ══════════════════════════════════════════════════════════════════════ */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronRight, ScanSearch, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { useAuthStore } from '../../../../stores/authStore';
import { api } from '../../../../lib/api';
import { aiXrayApi, type XrayCanal, type XrayResposta } from '../../../../lib/adminApi';

interface OrgLite {
  id: string;
  name: string;
}

const CANAIS: Array<{ valor: XrayCanal; rotulo: string; explicacao: string }> = [
  { valor: 'whatsapp', rotulo: 'WhatsApp', explicacao: 'O caminho principal. Consulta a base e monta todas as camadas.' },
  { valor: 'instagram', rotulo: 'Instagram Direct', explicacao: 'Hoje roda com as configurações do cliente vazias.' },
  { valor: 'site', rotulo: 'Chat do site', explicacao: 'Hoje não consulta a base nem injeta saudação e links.' },
  { valor: 'playground', rotulo: 'Testar minha IA', explicacao: 'O teste que o dono do negócio faz no painel.' },
  { valor: 'qualidade', rotulo: 'Teste de Qualidade', explicacao: 'O agente avaliado pelo golden set semanal.' },
];

const MAX_MENSAGENS = 5;

/** Uma mensagem por linha, no máximo cinco, sem linha em branco. */
function linhasEmMensagens(texto: string): string[] {
  return texto
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, MAX_MENSAGENS);
}

export default function AiXrayPage() {
  const router = useRouter();
  const { user } = useAuthStore();

  const [orgs, setOrgs] = useState<OrgLite[]>([]);
  const [organizationId, setOrganizationId] = useState('');
  const [canal, setCanal] = useState<XrayCanal>('whatsapp');
  const [texto, setTexto] = useState('vocês abrem no domingo?');
  const [resultado, setResultado] = useState<XrayResposta | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [abertas, setAbertas] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (user && user.role !== 'SUPERADMIN') router.push('/dashboard');
  }, [user, router]);

  // Lista de organizações: a mesma do seletor de org do header.
  useEffect(() => {
    if (user?.role !== 'SUPERADMIN') return;
    let vivo = true;
    api
      .get<{ organizations: OrgLite[] } | OrgLite[]>('/api/admin/organizations')
      .then((res: any) => {
        if (!vivo) return;
        const lista: OrgLite[] = Array.isArray(res) ? res : res?.organizations || res?.data || [];
        setOrgs(lista);
        if (lista.length && !organizationId) setOrganizationId(lista[0].id);
      })
      .catch(() => setOrgs([]));
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const mensagens = linhasEmMensagens(texto);

  async function rodar() {
    if (!organizationId || mensagens.length === 0) return;
    setCarregando(true);
    setErro(null);
    try {
      const res = await aiXrayApi.run({
        organizationId,
        canal,
        messages: mensagens.map((content) => ({ role: 'user' as const, content })),
      });
      setResultado(res);
      setAbertas({});
    } catch (err: any) {
      // O 422 de organização sem agente traz a frase legível em `message`.
      setErro(err?.details?.message || err?.message || 'Não foi possível montar o Raio-X');
      setResultado(null);
    } finally {
      setCarregando(false);
    }
  }

  function alternar(chave: string) {
    setAbertas((a) => ({ ...a, [chave]: !a[chave] }));
  }

  if (user?.role !== 'SUPERADMIN') return null;

  const canalEscolhido = CANAIS.find((c) => c.valor === canal);

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <ScanSearch className="text-primary-500" size={26} />
          Raio-X da IA
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Mostra exatamente o que a IA recebe em cada canal, e o que o cliente configurou e não chegou lá.
          Nenhum modelo é chamado: rodar aqui não custa nada.
        </p>
      </div>

      {/* Formulário */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="xray-org" className="block text-xs font-semibold text-gray-600 mb-1">
              Organização
            </label>
            <select
              id="xray-org"
              value={organizationId}
              onChange={(e) => setOrganizationId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-400"
            >
              {orgs.length === 0 && <option value="">Carregando organizações</option>}
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="xray-canal" className="block text-xs font-semibold text-gray-600 mb-1">
              Canal
            </label>
            <select
              id="xray-canal"
              value={canal}
              onChange={(e) => setCanal(e.target.value as XrayCanal)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-400"
            >
              {CANAIS.map((c) => (
                <option key={c.valor} value={c.valor}>
                  {c.rotulo}
                </option>
              ))}
            </select>
            {canalEscolhido && <p className="text-[11px] text-gray-500 mt-1">{canalEscolhido.explicacao}</p>}
          </div>
        </div>

        <div>
          <label htmlFor="xray-mensagens" className="block text-xs font-semibold text-gray-600 mb-1">
            Mensagens do cliente final, uma por linha
          </label>
          <textarea
            id="xray-mensagens"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={5}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono outline-none focus:ring-2 focus:ring-primary-400"
            placeholder={'vocês abrem no domingo?\nquanto custa?'}
          />
          <p className="text-[11px] text-gray-500 mt-1">
            De 1 a {MAX_MENSAGENS} mensagens. Cada uma vira um turno, com o histórico das anteriores.
            {mensagens.length > 0 && ` Agora: ${mensagens.length}.`}
          </p>
        </div>

        <button
          onClick={rodar}
          disabled={carregando || !organizationId || mensagens.length === 0}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-semibold hover:bg-primary-700 disabled:opacity-50"
        >
          {carregando ? 'Montando o prompt' : 'Ver o que a IA recebe'}
        </button>
      </div>

      {erro && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-900">Falha no Raio-X</p>
            <p className="text-xs text-red-700 mt-0.5">{erro}</p>
          </div>
        </div>
      )}

      {/* O que o Raio-X simplifica. Fica sempre visível, acima do resultado,
          porque são as diferenças que levariam alguém a ler um verde ou um
          vermelho daqui como se fosse a produção inteira. */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
        <AlertCircle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-amber-900 space-y-1">
          <p className="font-semibold">Leia com estas ressalvas</p>
          <p>
            No WhatsApp o contato é sintético: todo turno aparece como primeiro contato, e a
            saudação configurada entra em todos.
          </p>
          <p>
            A busca na base usa sempre 5 trechos e sem cache; no WhatsApp em Modo Econômico a
            produção usa 3.
          </p>
          <p>No canal Qualidade o agente é o comercial ativo mais recente da organização.</p>
          <p>
            O Raio-X não substitui o teste de Qualidade da IA: ele mostra o que entra no prompt,
            não a qualidade da resposta.
          </p>
          <p>
            As checagens de tom e de horário comparam com o que está no cadastro agora. Se o
            cadastro mudou depois da última conversa, o vermelho é sobre hoje, não sobre o passado.
          </p>
        </div>
      </div>

      {/* Resultado */}
      {resultado?.turnos.map((turno, idx) => (
        <div key={idx} className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold">
                Turno {idx + 1}
              </p>
              <p className="text-sm font-semibold text-gray-900 mt-0.5">{turno.mensagem}</p>
            </div>
            <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded whitespace-nowrap">
              {turno.prompt_chars.toLocaleString('pt-BR')} caracteres no prompt
            </span>
          </div>

          {/* Checagens */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-600">Checagens</p>
            {turno.checagens.map((c) => (
              <div
                key={c.id}
                className={`flex items-start gap-2 rounded-lg border p-3 ${
                  c.ok ? 'border-green-100 bg-green-50' : 'border-red-100 bg-red-50'
                }`}
              >
                {c.ok ? (
                  <CheckCircle2 size={16} className="text-green-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <XCircle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
                )}
                <div className="min-w-0">
                  <p className={`text-sm font-medium ${c.ok ? 'text-green-900' : 'text-red-900'}`}>
                    {c.rotulo}
                  </p>
                  <p className={`text-xs mt-0.5 break-words ${c.ok ? 'text-green-800' : 'text-red-800'}`}>
                    {c.detalhe}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Fontes */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-600">Fontes recuperadas da base</p>
            {turno.fontes.length === 0 ? (
              <p className="text-xs text-gray-500">
                Nenhuma. Neste canal, neste turno, a IA respondeu sem nada do treinamento do cliente.
              </p>
            ) : (
              <ul className="text-xs text-gray-700 space-y-1">
                {turno.fontes.map((f) => (
                  <li key={f.source} className="flex items-center justify-between gap-3 border-b border-gray-50 pb-1">
                    <span className="font-mono break-all">{f.source}</span>
                    <span className="text-gray-500 whitespace-nowrap">
                      similaridade {f.similarity.toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Fatias do prompt */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-600">O prompt, bloco a bloco</p>
            {turno.fatias.map((fatia, i) => {
              const chave = `${idx}:${i}`;
              const aberta = Boolean(abertas[chave]);
              return (
                <div key={chave} className="border border-gray-100 rounded-lg">
                  <button
                    onClick={() => alternar(chave)}
                    className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left hover:bg-gray-50"
                    aria-expanded={aberta}
                  >
                    <span className="flex items-center gap-2 text-sm text-gray-800">
                      {aberta ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      {fatia.titulo}
                    </span>
                    <span className="text-[11px] text-gray-500 whitespace-nowrap">
                      {fatia.chars.toLocaleString('pt-BR')} caracteres
                    </span>
                  </button>
                  {aberta && (
                    <pre className="px-3 pb-3 text-[11px] leading-relaxed text-gray-700 whitespace-pre-wrap break-words max-h-96 overflow-auto">
                      {fatia.texto}
                    </pre>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {resultado && resultado.turnos.length === 0 && (
        <p className="text-sm text-gray-500">Nenhuma mensagem de cliente final para analisar.</p>
      )}
    </div>
  );
}
