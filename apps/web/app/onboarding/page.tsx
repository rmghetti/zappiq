'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ChevronRight, ChevronLeft, ChevronDown, ChevronUp, Loader2, Info } from 'lucide-react';
import { Logo } from '../../components/Logo';
import { formatPhone } from '../../lib/masks';
import {
  GLOBAL_SURVEY_BLOCKS as RAW_GLOBAL_BLOCKS,
  SEGMENTS as RAW_SEGMENTS,
  SEGMENT_SURVEYS,
  type SurveyQuestion as RealSurveyQuestion,
  type SurveyBlock as RealSurveyBlock,
  type Segment as RealSegment,
} from '../../lib/surveyData';

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS (adaptados do surveyData para compatibilidade com o wizard)
// ─────────────────────────────────────────────────────────────────────────────
type SurveyQuestion = RealSurveyQuestion;

interface SurveyBlock {
  key: string;
  title: string;
  description?: string;
  questions: SurveyQuestion[];
}

interface Subsegment {
  key: string;
  label: string;
  description?: string;
}

interface Segment {
  key: string;
  icon: string;
  label: string;
  description: string;
  subsegments: Subsegment[];
}

// ─────────────────────────────────────────────────────────────────────────────
// DADOS REAIS (adaptados dos imports de surveyData)
// ─────────────────────────────────────────────────────────────────────────────

// Adapta Segment do surveyData (usa key==key) para compatibilidade
const SEGMENTS: Segment[] = RAW_SEGMENTS.map(s => ({
  key: s.key,
  icon: s.icon,
  label: s.label,
  description: s.description,
  subsegments: s.subsegments.map(ss => ({ key: ss.key, label: ss.label, description: ss.description })),
}));

// Adapta blocos globais (id → key)
const GLOBAL_SURVEY_BLOCKS: SurveyBlock[] = RAW_GLOBAL_BLOCKS.map(b => ({
  key: b.id,
  title: b.title,
  description: b.description,
  questions: b.questions,
}));

// Adapta surveys por segmento (SurveyBlock[] → SurveyQuestion[] flat)
function getSegmentQuestions(segmentKey: string): SurveyQuestion[] {
  const blocks = SEGMENT_SURVEYS[segmentKey];
  if (!blocks) return [];
  return blocks.flatMap(b => b.questions);
}

// Surveys por subsegmento (usa perguntas genéricas do segmento por enquanto)
function getSubsegmentQuestions(segmentKey: string, subsegmentKey: string): SurveyQuestion[] {
  // Prioriza surveys específicos do subsegmento se existirem
  const subKey = `${segmentKey}_${subsegmentKey}`;
  const blocks = SEGMENT_SURVEYS[subKey];
  if (blocks) return blocks.flatMap(b => b.questions);
  // Fallback: pergunta genérica
  return [
    { id: `sub_${subsegmentKey}_detalhes`, label: `Descreva os detalhes específicos de ${subsegmentKey.replace(/_/g, ' ')}`, type: 'textarea' as const, helpText: 'Informações adicionais que ajudam a IA a entender melhor esta especialidade' },
    { id: `sub_${subsegmentKey}_diferenciais`, label: 'Quais os diferenciais nesta especialidade?', type: 'textarea' as const, helpText: 'O que faz sua atuação neste subsegmento se destacar?' },
    { id: `sub_${subsegmentKey}_publico`, label: 'Qual o perfil do cliente que busca este serviço?', type: 'textarea' as const, helpText: 'Descreva o perfil típico de quem procura este subsegmento' },
    { id: `sub_${subsegmentKey}_objecoes`, label: 'Quais as objeções mais comuns nesta área?', type: 'textarea' as const, helpText: 'Objeções que a IA precisa saber contornar' },
    { id: `sub_${subsegmentKey}_preco`, label: 'Faixa de preço para este tipo de serviço', type: 'text' as const, helpText: 'Ajuda a IA a informar valores quando perguntada', placeholder: 'Ex: R$ 100 a R$ 500' },
  ];
}


// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTES DE STEPS E TONS
// ─────────────────────────────────────────────────────────────────────────────
const STEPS = ['Conta', 'Segmento', 'Subsegmentos', 'Informações Gerais', 'Segmento Específico', 'Subsegmentos Específicos', 'Agente IA', 'Finalizar'];

const TONES = [
  { key: 'friendly', label: '😊 Amigável', desc: 'Próximo e informal, como um amigo especialista' },
  { key: 'formal', label: '👔 Formal', desc: 'Profissional e respeitoso, passa autoridade' },
  { key: 'technical', label: '🔬 Técnico', desc: 'Preciso e direto, foco em dados e fatos' },
  { key: 'consultive', label: '🎯 Consultivo', desc: 'Faz perguntas antes de sugerir, como um consultor' },
];

const DAYS_OF_WEEK = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTES AUXILIARES
// ─────────────────────────────────────────────────────────────────────────────

/** Renderiza um campo de formulário baseado no tipo */
function FormField({ question, value, onChange }: { question: SurveyQuestion; value: any; onChange: (val: any) => void }) {
  const baseInputClass = 'w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-colors';

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {question.label}
        {question.required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {question.helpText && (
        <p className="text-xs text-gray-400 mb-2 flex items-start gap-1">
          <Info size={12} className="mt-0.5 flex-shrink-0 text-gray-300" />
          {question.helpText}
        </p>
      )}

      {question.type === 'textarea' && (
        <textarea
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          placeholder={question.placeholder}
          className={`${baseInputClass} resize-none`}
        />
      )}

      {question.type === 'select' && (
        <select
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className={baseInputClass}
        >
          <option value="">Selecione...</option>
          {question.options?.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      )}

      {question.type === 'multiselect' && (
        <div className="flex flex-wrap gap-2">
          {question.options?.map((opt) => {
            const selected = Array.isArray(value) && value.includes(opt);
            return (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  const current = Array.isArray(value) ? value : [];
                  onChange(selected ? current.filter((v: string) => v !== opt) : [...current, opt]);
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  selected
                    ? 'bg-primary-50 border-primary-500 text-primary-700'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                {selected && <Check size={10} className="inline mr-1" />}
                {opt}
              </button>
            );
          })}
        </div>
      )}

      {question.type === 'boolean' && (
        <div className="flex gap-3">
          {['Sim', 'Não'].map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt === 'Sim')}
              className={`px-5 py-2 rounded-lg text-sm font-medium border-2 transition-all ${
                (opt === 'Sim' && value === true) || (opt === 'Não' && value === false)
                  ? 'bg-primary-50 border-primary-500 text-primary-700'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}

      {question.type === 'number' && (
        <input
          type="number"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={question.placeholder}
          className={baseInputClass}
        />
      )}

      {question.type === 'phone' && (
        <input
          type="tel"
          inputMode="numeric"
          value={value || ''}
          onChange={(e) => onChange(formatPhone(e.target.value))}
          placeholder={question.placeholder || '+55 11 99999-9999'}
          maxLength={17}
          className={baseInputClass}
        />
      )}

      {(question.type === 'text' || question.type === 'url' || question.type === 'email') && (
        <input
          type={question.type === 'url' ? 'url' : question.type === 'email' ? 'email' : 'text'}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={question.placeholder}
          className={baseInputClass}
        />
      )}
    </div>
  );
}

/** Seção Accordion colapsável para blocos do survey */
function AccordionSection({
  block,
  answers,
  onAnswer,
  isOpen,
  onToggle,
}: {
  block: SurveyBlock;
  answers: Record<string, any>;
  onAnswer: (id: string, val: any) => void;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const answeredCount = block.questions.filter((q) => {
    const val = answers[q.id];
    if (val === undefined || val === null || val === '') return false;
    if (Array.isArray(val) && val.length === 0) return false;
    return true;
  }).length;
  const totalCount = block.questions.length;
  const progressPct = totalCount > 0 ? Math.round((answeredCount / totalCount) * 100) : 0;

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4 bg-white hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-gray-900">{block.title}</h3>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              progressPct === 100 ? 'bg-green-100 text-green-700' : progressPct > 0 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'
            }`}>
              {answeredCount}/{totalCount}
            </span>
          </div>
          {block.description && <p className="text-xs text-gray-400 mt-0.5">{block.description}</p>}
        </div>
        <div className="flex items-center gap-3">
          <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${progressPct === 100 ? 'bg-green-500' : 'bg-primary-500'}`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
          {isOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </div>
      </button>
      {isOpen && (
        <div className="px-5 pb-5 pt-2 space-y-4 border-t border-gray-100 bg-gray-50/50">
          {block.questions.map((q) => (
            <FormField key={q.id} question={q} value={answers[q.id]} onChange={(val) => onAnswer(q.id, val)} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Formulário principal
  const [form, setForm] = useState({
      // Step 0 - Conta
      name: '',
      businessName: '',
      email: '',
      password: '',
      phone: '',
      // Step 1 - Segmento
      segment: '',
      // Step 2 - Subsegmentos
      subsegments: [] as string[],
      // Step 3 - Global survey answers
      globalAnswers: {} as Record<string, any>,
      // Step 4 - Segment-specific answers
      segmentAnswers: {} as Record<string, any>,
      // Step 5 - Subsegment-specific answers
      subsegmentAnswers: {} as Record<string, Record<string, any>>,
      // Step 6 - Agente IA
      agentName: 'Bia',
      tone: 'friendly',
      greetingMessage: '',
      handoffMessage: '',
      businessHours: Object.fromEntries(DAYS_OF_WEEK.map((d) => [d, { open: '', close: '', closed: d === 'Domingo' }])) as Record<string, { open: string; close: string; closed: boolean }>,
  });

  // Inicializar com localStorage APÓS mount (evita hydration mismatch)
  useEffect(() => {
    setMounted(true);
    try {
      const token = localStorage.getItem('zappiq_token');
      if (token) {
        setStep(1); // Pula step 0 (conta) se já registrou
        const user = JSON.parse(localStorage.getItem('zappiq_user') || '{}');
        const orgName = localStorage.getItem('zappiq_org_name') || '';
        setForm((prev) => ({
          ...prev,
          name: user.name || prev.name,
          email: user.email || prev.email,
          businessName: orgName || prev.businessName,
          password: 'already_set',
        }));
      }
    } catch { /* sem dados salvos */ }
  }, []);

  // Accordion state para blocos globais (Step 3)
  const [openBlocks, setOpenBlocks] = useState<Record<string, boolean>>({ identidade_empresa: true });

  // Tab state para subsegmentos (Step 5)
  const [activeSubTab, setActiveSubTab] = useState(0);

  // Dados derivados
  const selectedSegment = useMemo(() => SEGMENTS.find((s) => s.key === form.segment), [form.segment]);
  const selectedSubsegments = useMemo(() => {
    if (!selectedSegment) return [];
    return selectedSegment.subsegments.filter((ss) => form.subsegments.includes(ss.key));
  }, [selectedSegment, form.subsegments]);

  const segmentQuestions = useMemo(() => {
    return getSegmentQuestions(form.segment);
  }, [form.segment]);

  // Helpers
  function updateForm<K extends keyof typeof form>(field: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function updateGlobalAnswer(id: string, val: any) {
    setForm((prev) => ({ ...prev, globalAnswers: { ...prev.globalAnswers, [id]: val } }));
  }

  function updateSegmentAnswer(id: string, val: any) {
    setForm((prev) => ({ ...prev, segmentAnswers: { ...prev.segmentAnswers, [id]: val } }));
  }

  function updateSubsegmentAnswer(subKey: string, id: string, val: any) {
    setForm((prev) => ({
      ...prev,
      subsegmentAnswers: {
        ...prev.subsegmentAnswers,
        [subKey]: { ...(prev.subsegmentAnswers[subKey] || {}), [id]: val },
      },
    }));
  }

  // Progresso global (porcentagem do survey global respondida)
  const globalProgress = useMemo(() => {
    const allQuestions = GLOBAL_SURVEY_BLOCKS.flatMap((b) => b.questions);
    const answered = allQuestions.filter((q) => {
      const val = form.globalAnswers[q.id];
      if (val === undefined || val === null || val === '') return false;
      if (Array.isArray(val) && val.length === 0) return false;
      return true;
    }).length;
    return { answered, total: allQuestions.length, pct: allQuestions.length > 0 ? Math.round((answered / allQuestions.length) * 100) : 0 };
  }, [form.globalAnswers]);

  // Validação por step
  function canAdvance(): boolean {
    switch (step) {
      case 0: return !!(form.name && form.email && form.password && form.businessName);
      case 1: return !!form.segment;
      case 2: return form.subsegments.length > 0;
      case 3: {
        // Permite avançar sempre — o preenchimento é progressivo e opcional
        // O progresso (%) é mostrado no UI para incentivar completar
        return true;
      }
      case 4: return true; // Segmento específico é opcional
      case 5: return true; // Subsegmentos específicos são opcionais
      case 6: return !!form.agentName;
      case 7: return true;
      default: return false;
    }
  }

  function goNext() {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function goBack() {
    if (step > 0) {
      // Se veio do register, não voltar para step 0
      const minStep = form.password === 'already_set' ? 1 : 0;
      setStep((s) => Math.max(s - 1, minStep));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  async function handleSubmit() {
    setLoading(true);
    setError('');
    try {
      // Salvar localmente
      localStorage.setItem('zappiq_onboarding', JSON.stringify(form));
      // Redirecionar
      router.push('/dashboard');
    } catch {
      setError('Erro ao salvar configurações. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  // Reset subsegmentos quando mudar segmento
  useEffect(() => {
    setForm((prev) => ({ ...prev, subsegments: [], subsegmentAnswers: {} }));
  }, [form.segment]);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  // Aguarda montagem para evitar hydration mismatch
  if (!mounted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Logo variant="positivo" height={36} />
          <span className="text-sm text-gray-400">
            Passo {step + 1} de {STEPS.length}
          </span>
        </div>
      </div>

      {/* Progress bar com labels */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
          {/* Steps mobile: just a bar */}
          <div className="sm:hidden mb-2">
            <div className="flex items-center gap-1">
              {STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`flex-1 h-1.5 rounded-full transition-colors ${
                    i < step ? 'bg-primary-500' : i === step ? 'bg-primary-400' : 'bg-gray-200'
                  }`}
                />
              ))}
            </div>
            <p className="text-xs text-primary-600 font-medium mt-2">{STEPS[step]}</p>
          </div>

          {/* Steps desktop */}
          <div className="hidden sm:block">
            <div className="flex items-center gap-1 mb-2">
              {STEPS.map((s, i) => (
                <div key={s} className="flex items-center gap-1 flex-1">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all flex-shrink-0 ${
                      i < step
                        ? 'bg-primary-500 text-white'
                        : i === step
                          ? 'bg-primary-500 text-white ring-4 ring-primary-100'
                          : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {i < step ? <Check size={12} /> : i + 1}
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={`flex-1 h-0.5 ${i < step ? 'bg-primary-500' : 'bg-gray-200'}`} />
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-between">
              {STEPS.map((s, i) => (
                <span
                  key={s}
                  className={`text-[10px] font-medium flex-1 text-center ${
                    i <= step ? 'text-primary-600' : 'text-gray-400'
                  }`}
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        {error && (
          <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm mb-6 border border-red-100">
            {error}
          </div>
        )}

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8">

          {/* ──────── Step 0: Conta ──────── */}
          {step === 0 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-1">Crie sua conta</h2>
                <p className="text-sm text-gray-500">Comece configurando seu acesso ao ZappIQ</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Seu nome <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={form.name}
                    onChange={(e) => updateForm('name', e.target.value)}
                    placeholder="João Silva"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome da empresa <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={form.businessName}
                    onChange={(e) => updateForm('businessName', e.target.value)}
                    placeholder="Minha Empresa"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  E-mail <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => updateForm('email', e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Senha <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) => updateForm('password', e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp (opcional)</label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={form.phone}
                    onChange={(e) => updateForm('phone', formatPhone(e.target.value))}
                    placeholder="+55 11 99999-9999"
                    maxLength={17}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ──────── Step 1: Segmento ──────── */}
          {step === 1 && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">Qual é o segmento do seu negócio?</h2>
              <p className="text-sm text-gray-500 mb-6">
                Seu agente de IA já virá pré-configurado com o vocabulário e fluxos do seu setor
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {SEGMENTS.map((seg) => (
                  <button
                    key={seg.key}
                    onClick={() => updateForm('segment', seg.key)}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-center ${
                      form.segment === seg.key
                        ? 'border-primary-500 bg-primary-50 shadow-sm'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <span className="text-2xl">{seg.icon}</span>
                    <span className="text-xs font-semibold text-gray-700">{seg.label}</span>
                    <span className="text-[10px] text-gray-400 leading-tight line-clamp-2">{seg.description}</span>
                    {form.segment === seg.key && <Check size={14} className="text-primary-500" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ──────── Step 2: Subsegmentos ──────── */}
          {step === 2 && selectedSegment && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">
                Quais especialidades de {selectedSegment.icon} {selectedSegment.label}?
              </h2>
              <p className="text-sm text-gray-500 mb-6">
                Selecione uma ou mais especialidades do seu negócio
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {selectedSegment.subsegments.map((sub) => {
                  const selected = form.subsegments.includes(sub.key);
                  return (
                    <button
                      key={sub.key}
                      onClick={() => {
                        const next = selected
                          ? form.subsegments.filter((s) => s !== sub.key)
                          : [...form.subsegments, sub.key];
                        updateForm('subsegments', next);
                      }}
                      className={`flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                        selected
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                          selected ? 'bg-primary-500 border-primary-500' : 'border-gray-300'
                        }`}
                      >
                        {selected && <Check size={12} className="text-white" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{sub.label}</p>
                        {sub.description && <p className="text-xs text-gray-400 mt-0.5">{sub.description}</p>}
                      </div>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-gray-400 mt-4 text-center">
                {form.subsegments.length} selecionado{form.subsegments.length !== 1 ? 's' : ''}
              </p>
            </div>
          )}

          {/* ──────── Step 3: Bloco Global (Accordion) ──────── */}
          {step === 3 && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-1">Informações Gerais do Negócio</h2>
                  <p className="text-sm text-gray-500">
                    Quanto mais informações, melhor a IA atenderá seus clientes
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-primary-600">{globalProgress.pct}%</p>
                  <p className="text-xs text-gray-400">{globalProgress.answered}/{globalProgress.total} campos</p>
                </div>
              </div>

              {/* Barra de progresso global */}
              <div className="w-full h-2 bg-gray-100 rounded-full mb-6 overflow-hidden">
                <div
                  className="h-full bg-primary-500 rounded-full transition-all duration-500"
                  style={{ width: `${globalProgress.pct}%` }}
                />
              </div>

              <div className="space-y-3">
                {GLOBAL_SURVEY_BLOCKS.map((block) => (
                  <AccordionSection
                    key={block.key}
                    block={block}
                    answers={form.globalAnswers}
                    onAnswer={updateGlobalAnswer}
                    isOpen={!!openBlocks[block.key]}
                    onToggle={() =>
                      setOpenBlocks((prev) => ({ ...prev, [block.key]: !prev[block.key] }))
                    }
                  />
                ))}
              </div>
            </div>
          )}

          {/* ──────── Step 4: Perguntas do Segmento ──────── */}
          {step === 4 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-1">
                  {selectedSegment?.icon} Perguntas para {selectedSegment?.label}
                </h2>
                <p className="text-sm text-gray-500">
                  Perguntas específicas do seu segmento para personalizar a IA
                </p>
              </div>
              {segmentQuestions.map((q) => (
                <FormField
                  key={q.id}
                  question={q}
                  value={form.segmentAnswers[q.id]}
                  onChange={(val) => updateSegmentAnswer(q.id, val)}
                />
              ))}
              {segmentQuestions.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-8">
                  Nenhuma pergunta adicional para este segmento.
                </p>
              )}
            </div>
          )}

          {/* ──────── Step 5: Perguntas dos Subsegmentos (Tabs) ──────── */}
          {step === 5 && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">
                Perguntas por Especialidade
              </h2>
              <p className="text-sm text-gray-500 mb-6">
                Responda as perguntas específicas de cada especialidade selecionada
              </p>

              {selectedSubsegments.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">
                  Nenhum subsegmento selecionado.
                </p>
              ) : (
                <>
                  {/* Tabs */}
                  <div className="flex gap-1 mb-6 border-b border-gray-200 overflow-x-auto">
                    {selectedSubsegments.map((sub, idx) => (
                      <button
                        key={sub.key}
                        onClick={() => setActiveSubTab(idx)}
                        className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                          activeSubTab === idx
                            ? 'border-primary-500 text-primary-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        {sub.label}
                      </button>
                    ))}
                  </div>

                  {/* Tab content */}
                  {selectedSubsegments[activeSubTab] && (() => {
                    const subKey = selectedSubsegments[activeSubTab].key;
                    const questions = getSubsegmentQuestions(form.segment, subKey);
                    const subAnswers = form.subsegmentAnswers[subKey] || {};
                    return (
                      <div className="space-y-5">
                        {questions.map((q) => (
                          <FormField
                            key={q.id}
                            question={q}
                            value={subAnswers[q.id]}
                            onChange={(val) => updateSubsegmentAnswer(subKey, q.id, val)}
                          />
                        ))}
                        {questions.length === 0 && (
                          <p className="text-sm text-gray-400 text-center py-8">
                            Nenhuma pergunta adicional para esta especialidade.
                          </p>
                        )}
                      </div>
                    );
                  })()}
                </>
              )}
            </div>
          )}

          {/* ──────── Step 6: Agente IA ──────── */}
          {step === 6 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-1">Configure seu Agente de IA</h2>
                <p className="text-sm text-gray-500">Personalize como sua IA vai atender seus clientes</p>
              </div>

              {/* Nome */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome do agente <span className="text-red-500">*</span>
                </label>
                <input
                  value={form.agentName}
                  onChange={(e) => updateForm('agentName', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                  placeholder="Ex: Bia, Luna, Max..."
                />
                <p className="text-xs text-gray-400 mt-1 flex items-start gap-1">
                  <Info size={12} className="mt-0.5 flex-shrink-0 text-gray-300" />
                  Esse é o nome que a IA usará para se apresentar ao cliente
                </p>
              </div>

              {/* Tom */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Tom de voz</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {TONES.map((t) => (
                    <button
                      key={t.key}
                      onClick={() => updateForm('tone', t.key)}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${
                        form.tone === t.key
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <p className="text-sm font-semibold text-gray-900">{t.label}</p>
                      <p className="text-xs text-gray-500 mt-1">{t.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Mensagem de boas-vindas */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mensagem de boas-vindas</label>
                <textarea
                  value={form.greetingMessage}
                  onChange={(e) => updateForm('greetingMessage', e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none resize-none"
                  placeholder={`Ex: Olá! Sou ${form.agentName || 'a Bia'}, assistente virtual da ${form.businessName || '[empresa]'}. Como posso te ajudar?`}
                />
              </div>

              {/* Mensagem de handoff */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mensagem ao transferir para humano</label>
                <textarea
                  value={form.handoffMessage}
                  onChange={(e) => updateForm('handoffMessage', e.target.value)}
                  rows={2}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none resize-none"
                  placeholder="Ex: Vou transferir você para um de nossos especialistas. Aguarde um momento!"
                />
              </div>

              {/* Horários */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Horário de atendimento</label>
                <div className="space-y-2">
                  {DAYS_OF_WEEK.map((day) => {
                    const hours = form.businessHours[day];
                    return (
                      <div key={day} className="flex items-center gap-3">
                        <span className="text-sm text-gray-700 w-20 font-medium">{day}</span>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!hours.closed}
                            onChange={(e) =>
                              updateForm('businessHours', {
                                ...form.businessHours,
                                [day]: { ...hours, closed: !e.target.checked },
                              })
                            }
                            className="rounded border-gray-300 text-primary-500 focus:ring-primary-500"
                          />
                          <span className="text-xs text-gray-500">{hours.closed ? 'Fechado' : 'Aberto'}</span>
                        </label>
                        {!hours.closed && (
                          <div className="flex items-center gap-2">
                            <input
                              type="time"
                              value={hours.open}
                              onChange={(e) =>
                                updateForm('businessHours', {
                                  ...form.businessHours,
                                  [day]: { ...hours, open: e.target.value },
                                })
                              }
                              className="px-2 py-1 border border-gray-200 rounded text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                            />
                            <span className="text-gray-400 text-xs">até</span>
                            <input
                              type="time"
                              value={hours.close}
                              onChange={(e) =>
                                updateForm('businessHours', {
                                  ...form.businessHours,
                                  [day]: { ...hours, close: e.target.value },
                                })
                              }
                              className="px-2 py-1 border border-gray-200 rounded text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ──────── Step 7: Finalizar ──────── */}
          {step === 7 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-1">Quase pronto!</h2>
                <p className="text-sm text-gray-500">Revise suas configurações e finalize o cadastro</p>
              </div>

              {/* Resumo */}
              <div className="bg-gray-50 rounded-xl p-5 space-y-4">
                <h3 className="text-sm font-semibold text-gray-900">Resumo da Configuração</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">Empresa:</span>{' '}
                    <span className="font-medium text-gray-900">{form.businessName}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Segmento:</span>{' '}
                    <span className="font-medium text-gray-900">
                      {selectedSegment?.icon} {selectedSegment?.label}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Especialidades:</span>{' '}
                    <span className="font-medium text-gray-900">
                      {selectedSubsegments.map((s) => s.label).join(', ') || 'Nenhuma'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Agente:</span>{' '}
                    <span className="font-medium text-gray-900">{form.agentName}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Tom:</span>{' '}
                    <span className="font-medium text-gray-900">
                      {TONES.find((t) => t.key === form.tone)?.label}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">E-mail:</span>{' '}
                    <span className="font-medium text-gray-900">{form.email}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Info. Gerais:</span>{' '}
                    <span className="font-medium text-gray-900">
                      {globalProgress.answered}/{globalProgress.total} respondidas ({globalProgress.pct}%)
                    </span>
                  </div>
                </div>
              </div>

              {/* Progresso por seção */}
              <div className="bg-gray-50 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Progresso por Seção</h3>
                <div className="space-y-2">
                  {GLOBAL_SURVEY_BLOCKS.map((block) => {
                    const answered = block.questions.filter((q) => {
                      const val = form.globalAnswers[q.id];
                      return val !== undefined && val !== null && val !== '' && !(Array.isArray(val) && val.length === 0);
                    }).length;
                    const total = block.questions.length;
                    const pct = total > 0 ? Math.round((answered / total) * 100) : 0;
                    return (
                      <div key={block.key} className="flex items-center gap-3">
                        <span className="text-xs text-gray-600 w-40 truncate">{block.title}</span>
                        <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${pct === 100 ? 'bg-green-500' : 'bg-primary-500'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-400 w-12 text-right">{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {form.greetingMessage && (
                <div className="bg-primary-50 rounded-xl p-5 border border-primary-100">
                  <h3 className="text-sm font-semibold text-primary-800 mb-2">Preview da Saudação</h3>
                  <div className="bg-white rounded-lg p-3 text-sm text-gray-700 shadow-sm">
                    {form.greetingMessage}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ──────── Navegação ──────── */}
        <div className="flex items-center justify-between mt-6">
          {step > (form.password === 'already_set' ? 1 : 0) ? (
            <button
              onClick={goBack}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ChevronLeft size={16} /> Voltar
            </button>
          ) : (
            <div />
          )}

          {step < STEPS.length - 1 ? (
            <button
              onClick={goNext}
              disabled={!canAdvance()}
              className="flex items-center gap-2 px-6 py-2.5 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Continuar <ChevronRight size={16} />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2.5 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600 disabled:opacity-50 transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Finalizando...
                </>
              ) : (
                <>Criar meu agente de IA</>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
