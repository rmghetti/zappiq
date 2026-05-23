'use client';

/**
 * SurveyPanel — questionário de qualificação editável dentro do /ai-training.
 *
 * Por que existe: depois do onboarding, o cliente NÃO tinha onde re-responder
 * ou completar o survey (o /onboarding redireciona quem já tem org pro
 * /dashboard). O survey vale 30 pts do AI Readiness e é o maior peso. Sem este
 * painel, o cliente não conseguia subir esse chunk nem corrigir respostas.
 *
 * Integração: GET/PUT /api/ai-training/survey. O PUT re-sincroniza o RAG
 * (knowledgeBaseBuilder) — ou seja, o que é respondido aqui ALIMENTA o agente.
 * Shape preservado do onboarding: surveyAnswers = {
 *   identidade_empresa: { [questionId]: resposta },  // perguntas globais
 *   segmento: {...}, subsegmentos: {...}              // preservados intactos
 * }
 */
import { useEffect, useState } from 'react';
import { Loader2, Save, CheckCircle2, Circle } from 'lucide-react';
import { GLOBAL_SURVEY_BLOCKS } from '../../lib/surveyData';
import type { SurveyQuestion } from '../../lib/surveyData';
import { api } from '../../lib/api';

// Chave top-level onde o onboarding grava as respostas globais (por question.id).
const SECTION_KEY = 'identidade_empresa';

const ALL_QUESTIONS: SurveyQuestion[] = GLOBAL_SURVEY_BLOCKS.flatMap((b) => b.questions);

function isAnswered(v: any): boolean {
  if (v === undefined || v === null) return false;
  if (Array.isArray(v)) return v.length > 0;
  return String(v).trim() !== '';
}

export function SurveyPanel({ onChange }: { onChange?: () => void }) {
  const [full, setFull] = useState<Record<string, any>>({});
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.get<{ surveyAnswers: Record<string, any> }>('/api/ai-training/survey');
        const sa = data?.surveyAnswers || {};
        setFull(sa);
        setAnswers((sa[SECTION_KEY] as Record<string, any>) || {});
      } catch {
        /* sem respostas ainda — começa vazio */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const answeredCount = ALL_QUESTIONS.filter((q) => isAnswered(answers[q.id])).length;
  const total = ALL_QUESTIONS.length;
  const pct = total ? Math.round((answeredCount / total) * 100) : 0;

  function setVal(id: string, value: any) {
    setAnswers((a) => ({ ...a, [id]: value }));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const surveyAnswers = { ...full, [SECTION_KEY]: answers };
      await api.put('/api/ai-training/survey', { surveyAnswers });
      setFull(surveyAnswers);
      setSaved(true);
      onChange?.();
    } catch (e: any) {
      setError(e?.message || 'Falha ao salvar o questionário');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-500 p-8 justify-center">
        <Loader2 size={18} className="animate-spin" /> Carregando questionário…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Cabeçalho com progresso + salvar */}
      <div className="flex items-center justify-between gap-4 sticky top-0 bg-white py-2 z-10 border-b border-gray-100">
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-900">
            Questionário de qualificação — {answeredCount}/{total} respondidas ({pct}%)
          </p>
          <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1.5 max-w-md">
            <div className="h-full rounded-full bg-gradient-to-r from-primary-400 to-secondary-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-xs text-gray-500 mt-1">Tudo que você responder aqui treina a IA — re-sincroniza a base de conhecimento na hora de salvar.</p>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="px-4 py-2 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600 flex items-center gap-2 disabled:opacity-50 whitespace-nowrap"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {saved ? 'Salvo ✓' : 'Salvar respostas'}
        </button>
      </div>

      {error && <div className="px-4 py-2 bg-red-50 text-red-700 text-sm rounded-lg border border-red-100">{error}</div>}

      {GLOBAL_SURVEY_BLOCKS.map((block) => (
        <section key={block.id} className="rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-bold text-gray-900">{block.title}</h3>
          {block.description && <p className="text-xs text-gray-500 mt-0.5 mb-3">{block.description}</p>}
          <div className="space-y-4">
            {block.questions.map((q) => (
              <Field key={q.id} q={q} value={answers[q.id]} onChange={(v) => setVal(q.id, v)} />
            ))}
          </div>
        </section>
      ))}

      <div className="flex justify-end">
        <button
          onClick={save}
          disabled={saving}
          className="px-5 py-2.5 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600 flex items-center gap-2 disabled:opacity-50"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {saved ? 'Salvo ✓' : 'Salvar respostas'}
        </button>
      </div>
    </div>
  );
}

function Field({ q, value, onChange }: { q: SurveyQuestion; value: any; onChange: (v: any) => void }) {
  const answered = isAnswered(value);
  const base = 'w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-primary-400';
  const borderCls = answered ? 'border-gray-200' : 'border-amber-300 bg-amber-50/40';

  return (
    <div>
      <label className="flex items-start gap-1.5 text-sm font-medium text-gray-800 mb-1">
        {answered ? <CheckCircle2 size={14} className="text-secondary-600 mt-0.5 shrink-0" /> : <Circle size={14} className="text-amber-400 mt-0.5 shrink-0" />}
        <span>{q.label}{q.required && <span className="text-red-500"> *</span>}</span>
      </label>

      {q.type === 'textarea' && (
        <textarea value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder={q.placeholder} rows={3} className={`${base} ${borderCls} resize-y`} />
      )}
      {q.type === 'select' && (
        <select value={value || ''} onChange={(e) => onChange(e.target.value)} className={`${base} ${borderCls}`}>
          <option value="">Selecione…</option>
          {(q.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
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
          placeholder={q.placeholder}
          className={`${base} ${borderCls}`}
        />
      )}

      {q.helpText && <p className="text-[11px] text-gray-400 mt-1">{q.helpText}</p>}
    </div>
  );
}
