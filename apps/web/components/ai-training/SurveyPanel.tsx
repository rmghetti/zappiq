'use client';

/**
 * SurveyPanel — questionário de qualificação editável dentro do /ai-training.
 *
 * Por que existe: depois do cadastro, o cliente NÃO tinha onde re-responder
 * ou completar o questionário (o /onboarding manda quem já tem org para o
 * /dashboard). O questionário vale 30 pontos do AI Readiness e é o maior
 * peso. Sem este painel, o cliente não conseguia subir esse pedaço nem
 * corrigir resposta nenhuma.
 *
 * O que mudou em 14/09/2026:
 *   A177  as perguntas do SEGMENTO e da ESPECIALIDADE passam a aparecer
 *         aqui, com o mesmo autosave. Antes só existiam no cadastro: quem
 *         pulou lá nunca mais respondia.
 *   A211  pergunta que configura função que a plataforma não executa
 *         aparece com a etiqueta honesta ('em breve'), e deixou de ser
 *         obrigatória.
 *   A008  a tela passa a dizer se a IA já recebeu a versão salva. Antes
 *         dizia 'salvo automaticamente' mesmo quando a ingestão falhava.
 *
 * Integração: GET/PUT /api/ai-training/survey. O PUT grava as respostas e
 * AGENDA a reingestão (30 s por organização), então salvar deixou de
 * reembedar o questionário inteiro a cada pausa de digitação.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { Loader2, Save, CheckCircle2, Circle, CloudOff, Clock, AlertTriangle } from 'lucide-react';
import type { SurveyQuestion } from '../../lib/surveyData';
import {
  secoesDoPainel,
  lerResposta,
  gravarResposta,
  progressoDoPainel,
  estaRespondida,
  avisoDaPergunta,
  textoDaSincronizacao,
  type SecaoDoPainel,
  type SurveySync,
} from '../../lib/surveyPainel';
import { api } from '../../lib/api';
import { examplePlaceholder } from '../../lib/surveyExamples';

// Status do autosave mostrado no cabeçalho.
type AutoState = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

/**
 * Espera do autosave. Eram 1,5 s, o que gerava rajadas de até dez
 * gravações por minuto (A007). Cinco segundos cobre a digitação de uma
 * resposta inteira e continua salvando sozinho sem o cliente clicar.
 */
const ESPERA_DO_AUTOSAVE_MS = 5000;

const ROTULO_DA_ORIGEM: Record<SecaoDoPainel['origem'], string | null> = {
  global: null,
  segmento: 'do seu segmento',
  especialidade: 'da sua especialidade',
};

export function SurveyPanel({ onChange }: { onChange?: () => void }) {
  const [respostas, setRespostas] = useState<Record<string, any>>({});
  const [secoes, setSecoes] = useState<SecaoDoPainel[]>(() => secoesDoPainel({}));
  const [niche, setNiche] = useState<string>('');
  const [sync, setSync] = useState<SurveySync | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false); // save manual (botão)
  const [auto, setAuto] = useState<AutoState>('idle');
  const [error, setError] = useState<string | null>(null);

  // Refs para o autosave enxergar sempre o estado mais recente sem recriar
  // o timer a cada tecla.
  const respostasRef = useRef(respostas);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const emVooRef = useRef(false);
  const skipFirst = useRef(true);
  useEffect(() => {
    respostasRef.current = respostas;
  }, [respostas]);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.get<{
          surveyAnswers: Record<string, any>;
          niche?: string;
          segmento?: string;
          subsegmentos?: string[];
          surveySync?: SurveySync | null;
        }>('/api/ai-training/survey');
        setRespostas(data?.surveyAnswers || {});
        setSecoes(secoesDoPainel({ segmento: data?.segmento, subsegmentos: data?.subsegmentos }));
        if (data?.niche) setNiche(data.niche);
        setSync(data?.surveySync ?? null);
      } catch {
        /* sem respostas ainda: começa vazio */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const progresso = progressoDoPainel(secoes, respostas);

  // Persiste no backend (que agenda a reingestão). `manual` vem do botão.
  const persist = useCallback(
    async (snapshot: Record<string, any>, manual: boolean) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      if (manual) setSaving(true);
      setAuto('saving');
      setError(null);
      emVooRef.current = true;
      try {
        const resposta = await api.put<{ surveySync?: SurveySync }>('/api/ai-training/survey', {
          surveyAnswers: snapshot,
        });
        setAuto('saved');
        setSync(resposta?.surveySync ?? { status: 'pendente', at: new Date().toISOString() });
        onChange?.();
      } catch (e: any) {
        setError(e?.message || 'Falha ao salvar o questionário');
        setAuto('error');
      } finally {
        emVooRef.current = false;
        if (manual) setSaving(false);
      }
    },
    [onChange],
  );

  // AUTOSAVE: salva sozinho depois que o cliente para de digitar. Se ainda
  // houver uma gravação em voo, espera mais um pouco em vez de mandar duas
  // ao mesmo tempo (era assim que duas versões chegavam fora de ordem).
  useEffect(() => {
    if (loading) return;
    if (skipFirst.current) {
      skipFirst.current = false;
      return;
    }
    setAuto('pending');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const agendar = (espera: number) => {
      debounceRef.current = setTimeout(() => {
        if (emVooRef.current) {
          agendar(1000);
          return;
        }
        void persist(respostasRef.current, false);
      }, espera);
    };
    agendar(ESPERA_DO_AUTOSAVE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [respostas, loading, persist]);

  // Avisa se o cliente tentar sair com algo ainda não salvo.
  useEffect(() => {
    function beforeUnload(e: BeforeUnloadEvent) {
      if (auto === 'pending' || auto === 'saving') {
        e.preventDefault();
        e.returnValue = '';
      }
    }
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [auto]);

  function setVal(secao: SecaoDoPainel, id: string, value: any) {
    setRespostas((atual) => gravarResposta(atual, secao.caminho, id, value));
  }

  function save() {
    void persist(respostasRef.current, true);
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-500 p-8 justify-center">
        <Loader2 size={18} className="animate-spin" /> Carregando questionário…
      </div>
    );
  }

  const estado = textoDaSincronizacao(sync);

  return (
    <div className="space-y-5">
      {/* Cabeçalho com progresso + salvar */}
      <div className="flex items-center justify-between gap-4 sticky top-0 bg-white py-2 z-10 border-b border-gray-100">
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-900">
            Questionário de qualificação: {progresso.respondidas}/{progresso.total} respondidas ({progresso.pct}%)
          </p>
          <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1.5 max-w-md">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary-400 to-secondary-500 transition-all"
              style={{ width: `${progresso.pct}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1 flex items-center gap-1.5">
            Tudo que você responder aqui treina a IA. Salva sozinho.
            {auto === 'pending' && <span className="text-gray-400">· alterações não salvas…</span>}
            {auto === 'saving' && (
              <span className="text-primary-600 inline-flex items-center gap-1">
                <Loader2 size={11} className="animate-spin" /> salvando…
              </span>
            )}
            {auto === 'saved' && (
              <span className="text-secondary-600 inline-flex items-center gap-1">
                <CheckCircle2 size={11} /> respostas salvas
              </span>
            )}
            {auto === 'error' && (
              <span className="text-red-600 inline-flex items-center gap-1">
                <CloudOff size={11} /> falha ao salvar
              </span>
            )}
          </p>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="px-4 py-2 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600 flex items-center gap-2 disabled:opacity-50 whitespace-nowrap"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {auto === 'saved' && !saving ? 'Salvo ✓' : 'Salvar respostas'}
        </button>
      </div>

      {/* A008: salvar a resposta e entregá-la à IA são duas coisas. */}
      <div
        className={`flex items-start gap-2 px-4 py-2.5 rounded-lg border text-sm ${
          estado.tom === 'ok'
            ? 'bg-secondary-50 border-secondary-100 text-secondary-800'
            : estado.tom === 'falhou'
              ? 'bg-red-50 border-red-100 text-red-700'
              : 'bg-amber-50 border-amber-100 text-amber-800'
        }`}
      >
        {estado.tom === 'ok' ? (
          <CheckCircle2 size={15} className="mt-0.5 shrink-0" />
        ) : estado.tom === 'falhou' ? (
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
        ) : (
          <Clock size={15} className="mt-0.5 shrink-0" />
        )}
        <span>{estado.texto}</span>
      </div>

      {error && (
        <div className="px-4 py-2 bg-red-50 text-red-700 text-sm rounded-lg border border-red-100">{error}</div>
      )}

      {secoes.map((secao, indice) => {
        const rotuloOrigem = ROTULO_DA_ORIGEM[secao.origem];
        return (
          <section key={`${secao.caminho.join('.')}-${secao.bloco.id}-${indice}`} className="rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              {secao.bloco.title}
              {rotuloOrigem && (
                <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-primary-50 text-primary-600 border border-primary-100">
                  {rotuloOrigem}
                </span>
              )}
            </h3>
            {secao.bloco.description && (
              <p className="text-xs text-gray-500 mt-0.5 mb-3">{secao.bloco.description}</p>
            )}
            <div className="space-y-4">
              {secao.bloco.questions.map((q) => (
                <Field
                  key={q.id}
                  q={q}
                  niche={niche}
                  value={lerResposta(respostas, secao.caminho, q.id)}
                  onChange={(v) => setVal(secao, q.id, v)}
                />
              ))}
            </div>
          </section>
        );
      })}

      <div className="flex justify-end">
        <button
          onClick={save}
          disabled={saving}
          className="px-5 py-2.5 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600 flex items-center gap-2 disabled:opacity-50"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {auto === 'saved' && !saving ? 'Salvo ✓' : 'Salvar respostas'}
        </button>
      </div>
    </div>
  );
}

function Field({
  q,
  value,
  onChange,
  niche,
}: {
  q: SurveyQuestion;
  value: any;
  onChange: (v: any) => void;
  niche?: string;
}) {
  const answered = estaRespondida(value);
  const base = 'w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-primary-400';
  const borderCls = answered ? 'border-gray-200' : 'border-amber-300 bg-amber-50/40';
  // Exemplo relevante ao segmento (niche); cai no placeholder original se não houver.
  const ph = examplePlaceholder(niche, q.id, q.placeholder);
  const aviso = avisoDaPergunta(q.id);

  return (
    <div>
      <label className="flex items-start gap-1.5 text-sm font-medium text-gray-800 mb-1">
        {answered ? (
          <CheckCircle2 size={14} className="text-secondary-600 mt-0.5 shrink-0" />
        ) : (
          <Circle size={14} className="text-amber-400 mt-0.5 shrink-0" />
        )}
        <span>
          {q.label}
          {q.required && <span className="text-red-500"> *</span>}
          {aviso && (
            <span
              title={aviso.detalhe}
              className={`ml-2 text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full border ${
                aviso.tom === 'em_breve'
                  ? 'bg-gray-50 text-gray-500 border-gray-200'
                  : aviso.tom === 'configuracao'
                    ? 'bg-blue-50 text-blue-600 border-blue-100'
                    : 'bg-gray-50 text-gray-500 border-gray-200'
              }`}
            >
              {aviso.rotulo}
            </span>
          )}
        </span>
      </label>

      {q.type === 'textarea' && (
        <textarea
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={ph}
          rows={3}
          className={`${base} ${borderCls} resize-y`}
        />
      )}
      {q.type === 'select' && (
        <select value={value || ''} onChange={(e) => onChange(e.target.value)} className={`${base} ${borderCls}`}>
          <option value="">Selecione…</option>
          {(q.options || []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      )}
      {q.type === 'multiselect' && (
        <div className="flex flex-wrap gap-2">
          {(q.options || []).map((o) => {
            const arr: string[] = Array.isArray(value) ? value : [];
            const on = arr.includes(o);
            return (
              <button
                key={o}
                type="button"
                onClick={() => onChange(on ? arr.filter((x) => x !== o) : [...arr, o])}
                className={`px-3 py-1.5 rounded-full text-xs border ${on ? 'bg-primary-500 text-white border-primary-500' : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'}`}
              >
                {o}
              </button>
            );
          })}
        </div>
      )}
      {q.type === 'boolean' && (
        <div className="flex gap-2">
          {['Sim', 'Não'].map((opt) => {
            const on = value === opt;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => onChange(opt)}
                className={`px-4 py-1.5 rounded-lg text-sm border ${on ? 'bg-primary-500 text-white border-primary-500' : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'}`}
              >
                {opt}
              </button>
            );
          })}
        </div>
      )}
      {['text', 'number', 'phone', 'url', 'email'].includes(q.type) && (
        <input
          type={q.type === 'number' ? 'number' : q.type === 'email' ? 'email' : q.type === 'url' ? 'url' : 'text'}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={ph}
          className={`${base} ${borderCls}`}
        />
      )}

      {q.helpText && <p className="text-[11px] text-gray-400 mt-1">{q.helpText}</p>}
      {aviso && <p className="text-[11px] text-gray-400 mt-1">{aviso.detalhe}</p>}
    </div>
  );
}
