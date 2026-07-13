'use client';

/* ══════════════════════════════════════════════════════════════════════════
 * DiagnosticoWizard: wizard passo a passo + relatório na hora
 * --------------------------------------------------------------------------
 * Passa pelas 15 perguntas (single radio-cards, multi checkbox-cards, um campo
 * de texto opcional), coleta contato + consentimento LGPD, computa o plano
 * ideal com recomendar(answers) e mostra o relatório na própria página. Em
 * paralelo, dispara um POST fire-and-forget para /api/diagnostico (lead + email).
 * Design system da landing. Sem travessão em nenhum texto.
 * ══════════════════════════════════════════════════════════════════════════ */

import { useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { QUESTIONS } from '../../lib/diagnostico/data';
import { recomendar, type Answers, type Recommendation } from '../../lib/diagnostico/engine';

const TOTAL_STEPS = QUESTIONS.length + 1; // perguntas + passo de contato

interface ContactData {
  empresa: string;
  contato: string;
  email: string;
  telefone: string;
  consent: boolean;
}

const EMPTY_CONTACT: ContactData = {
  empresa: '',
  contato: '',
  email: '',
  telefone: '',
  consent: false,
};

export function DiagnosticoWizard() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [contact, setContact] = useState<ContactData>(EMPTY_CONTACT);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [report, setReport] = useState<Recommendation | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isContactStep = step === QUESTIONS.length;
  const question = isContactStep ? null : QUESTIONS[step];

  /* ── helpers de leitura das respostas ── */
  const oneA = (id: string): string => {
    const v = answers[id];
    return Array.isArray(v) ? v[0] ?? '' : (v as string) ?? '';
  };
  const manyA = (id: string): string[] => {
    const v = answers[id];
    return Array.isArray(v) ? v : v ? [v as string] : [];
  };
  const labelFor = (qid: string, value: string): string => {
    const q = QUESTIONS.find((x) => x.id === qid);
    return q?.options?.find((o) => o.value === value)?.label ?? value;
  };

  const clearTimer = () => {
    if (advanceTimer.current) {
      clearTimeout(advanceTimer.current);
      advanceTimer.current = null;
    }
  };

  const goNext = () => {
    clearTimer();
    setStep((s) => Math.min(s + 1, QUESTIONS.length));
  };

  const goBack = () => {
    clearTimer();
    setErrors({});
    setStep((s) => Math.max(s - 1, 0));
  };

  /* ── seleção ── */
  const selectSingle = (qid: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [qid]: value }));
    // avança sozinho após um instante (dá tempo de ver a marcação)
    clearTimer();
    advanceTimer.current = setTimeout(() => goNext(), 320);
  };

  const toggleMulti = (qid: string, value: string, maxSelect?: number) => {
    setAnswers((prev) => {
      const arr = Array.isArray(prev[qid]) ? [...(prev[qid] as string[])] : [];
      const idx = arr.indexOf(value);
      if (idx >= 0) {
        arr.splice(idx, 1);
      } else {
        if (maxSelect && arr.length >= maxSelect) return prev;
        arr.push(value);
      }
      return { ...prev, [qid]: arr };
    });
  };

  const setOpen = (qid: string, text: string) => {
    setAnswers((prev) => ({ ...prev, [qid]: text }));
  };

  /* ── pode avançar? ── */
  const canContinue = (): boolean => {
    if (isContactStep || !question) return true;
    if (question.openField) return true; // opcional
    if (question.type === 'multi') return manyA(question.id).length > 0;
    return !!oneA(question.id);
  };

  /* ── validação do contato ── */
  const validateContact = (): boolean => {
    const e: Record<string, string> = {};
    if (!contact.empresa.trim()) e.empresa = 'Informe o nome da empresa.';
    if (!contact.contato.trim()) e.contato = 'Informe o seu nome.';
    if (!contact.email.trim()) e.email = 'Informe o seu e-mail.';
    else if (!/.+@.+\..+/.test(contact.email.trim())) e.email = 'Digite um e-mail válido.';
    if (!contact.consent) e.consent = 'É necessário autorizar para gerar o relatório.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  /* ── envio ── */
  const handleSubmit = (evt: React.FormEvent) => {
    evt.preventDefault();
    if (!validateContact()) return;
    setSubmitting(true);

    // Relatório na hora (não depende da rede)
    const rec = recomendar(answers);

    // Lead + e-mails: fire-and-forget, não bloqueia a exibição
    try {
      void fetch('/api/diagnostico', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresa: contact.empresa.trim(),
          contato: contact.contato.trim(),
          email: contact.email.trim(),
          telefone: contact.telefone.trim() || undefined,
          consent: contact.consent,
          answers,
        }),
      }).catch(() => {});
    } catch {
      /* rede indisponível: seguimos mostrando o relatório mesmo assim */
    }

    setReport(rec);
    setSubmitting(false);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const restart = () => {
    clearTimer();
    setReport(null);
    setStep(0);
    setAnswers({});
    setContact(EMPTY_CONTACT);
    setErrors({});
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /* ══════════════════════ RELATÓRIO ══════════════════════ */
  if (report) {
    return (
      <ReportView
        rec={report}
        contato={contact.contato}
        empresa={contact.empresa}
        perfil={buildPerfil()}
        onRestart={restart}
      />
    );
  }

  /* monta as respostas-chave para o "seu perfil" */
  function buildPerfil(): { rotulo: string; valor: string }[] {
    const itens: { rotulo: string; valor: string }[] = [];
    const objetivos = manyA('objetivo').map((v) => labelFor('objetivo', v));
    if (objetivos.length) itens.push({ rotulo: 'O que você quer resolver', valor: objetivos.join(', ') });
    if (oneA('segmento')) itens.push({ rotulo: 'Segmento', valor: labelFor('segmento', oneA('segmento')) });
    if (oneA('conversas')) itens.push({ rotulo: 'Volume de conversas', valor: labelFor('conversas', oneA('conversas')) });
    return itens.slice(0, 3);
  }

  const progressPct = Math.round(((step + 1) / TOTAL_STEPS) * 100);

  /* ══════════════════════ WIZARD ══════════════════════ */
  return (
    <section className="pb-20 lg:pb-28 pt-2">
      <div className="zappiq-wrap">
        <div className="max-w-[720px] mx-auto">
          {/* Cabeçalho */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-bg-soft border border-line text-[12px] text-muted mb-5">
              <span className="w-2 h-2 rounded-full bg-grad" />
              Diagnóstico de Perfil · 2 minutos · gratuito
            </div>
            <h1 className="text-[30px] sm:text-[38px] lg:text-[44px] leading-[1.05] tracking-[-0.035em] font-semibold text-ink mb-3">
              Descubra o <span className="text-grad">plano ideal</span> para a sua operação
            </h1>
            <p className="text-[16px] lg:text-[17px] text-muted leading-[1.55] max-w-[560px] mx-auto">
              Responda a algumas perguntas rápidas e receba, na hora, a recomendação de plano,
              produtos e add-ons certos para o seu negócio.
            </p>
          </div>

          {/* Progresso */}
          <div className="mb-6">
            <div className="flex items-center justify-between text-[12.5px] text-muted mb-2">
              <span className="font-medium text-ink">
                {isContactStep ? 'Últimos dados' : `Pergunta ${step + 1} de ${QUESTIONS.length}`}
              </span>
              <span>{progressPct}%</span>
            </div>
            <div
              className="h-2 rounded-full bg-bg-soft overflow-hidden"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progressPct}
              aria-label="Progresso do diagnóstico"
            >
              <div
                className="h-full bg-grad rounded-full transition-[width] duration-500 ease-out"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          {/* Card */}
          <div className="bg-white border border-line rounded-[24px] p-6 sm:p-8 shadow-[var(--shadow-card)]">
            {isContactStep ? (
              <ContactStep
                contact={contact}
                setContact={setContact}
                errors={errors}
                onSubmit={handleSubmit}
                submitting={submitting}
              />
            ) : question ? (
              <QuestionStep
                question={question}
                singleValue={oneA(question.id)}
                multiValues={manyA(question.id)}
                openValue={oneA(question.id)}
                onSingle={selectSingle}
                onMulti={toggleMulti}
                onOpen={setOpen}
              />
            ) : null}

            {/* Navegação (esconde o "Continuar" no passo de contato, que tem submit próprio) */}
            {!isContactStep && (
              <div className="flex items-center justify-between gap-3 mt-8 pt-6 border-t border-line">
                <button
                  type="button"
                  onClick={goBack}
                  disabled={step === 0}
                  className="btn btn-line btn-lg disabled:opacity-40 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                >
                  <ChevronLeft size={18} aria-hidden /> Voltar
                </button>
                <button
                  type="button"
                  onClick={goNext}
                  disabled={!canContinue()}
                  className="btn btn-accent btn-lg disabled:opacity-40 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                >
                  Continuar <ChevronRight size={18} aria-hidden />
                </button>
              </div>
            )}
          </div>

          <p className="text-center text-[12.5px] text-muted mt-5">
            Seus dados ficam no Brasil e são usados apenas para gerar o relatório e falar sobre o resultado.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * Passo de pergunta
 * ══════════════════════════════════════════════════════════════════════════ */
function QuestionStep({
  question,
  singleValue,
  multiValues,
  openValue,
  onSingle,
  onMulti,
  onOpen,
}: {
  question: (typeof QUESTIONS)[number];
  singleValue: string;
  multiValues: string[];
  openValue: string;
  onSingle: (qid: string, value: string) => void;
  onMulti: (qid: string, value: string, maxSelect?: number) => void;
  onOpen: (qid: string, text: string) => void;
}) {
  const helpId = `${question.id}-help`;
  const maxed =
    question.type === 'multi' &&
    !!question.maxSelect &&
    multiValues.length >= question.maxSelect;

  return (
    <fieldset aria-describedby={question.help ? helpId : undefined}>
      <legend className="text-[20px] sm:text-[23px] font-semibold text-ink tracking-[-0.02em] leading-[1.25] mb-2">
        {question.title}
        {question.optional && <span className="ml-2 text-[13px] font-normal text-muted">(opcional)</span>}
      </legend>
      {question.help && (
        <p id={helpId} className="text-[14px] text-muted leading-[1.5] mb-5">
          {question.help}
        </p>
      )}
      {!question.help && <div className="mb-5" />}

      {/* Campo aberto (Q dor) */}
      {question.openField ? (
        <div>
          <label htmlFor={`${question.id}-open`} className="sr-only">
            {question.title}
          </label>
          <textarea
            id={`${question.id}-open`}
            value={openValue}
            onChange={(e) => onOpen(question.id, e.target.value.slice(0, 400))}
            rows={3}
            placeholder="Ex.: perco venda porque demoro a responder fora do horário comercial."
            className="w-full rounded-[14px] border border-line bg-white px-4 py-3 text-[15px] text-ink placeholder:text-muted-2 leading-[1.5] resize-none focus:outline-none focus:border-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
          />
          <div className="text-right text-[12px] text-muted-2 mt-1">{openValue.length}/400</div>
        </div>
      ) : (
        <div className="grid gap-2.5">
          {question.options?.map((opt) => {
            const checked =
              question.type === 'multi'
                ? multiValues.includes(opt.value)
                : singleValue === opt.value;
            const disabled = question.type === 'multi' && !checked && maxed;
            return (
              <label
                key={opt.value}
                className={`group relative flex items-center gap-3 rounded-[14px] border px-4 py-3.5 transition-colors ${
                  checked
                    ? 'border-accent bg-accent-soft'
                    : disabled
                      ? 'border-line opacity-45 cursor-not-allowed'
                      : 'border-line hover:border-accent/50 cursor-pointer'
                }`}
              >
                <input
                  type={question.type === 'multi' ? 'checkbox' : 'radio'}
                  name={question.id}
                  value={opt.value}
                  checked={checked}
                  disabled={disabled}
                  onChange={() =>
                    question.type === 'multi'
                      ? onMulti(question.id, opt.value, question.maxSelect)
                      : onSingle(question.id, opt.value)
                  }
                  className="peer sr-only"
                />
                {/* Indicador */}
                <span
                  className={`flex-shrink-0 w-5 h-5 flex items-center justify-center border transition-colors ${
                    question.type === 'multi' ? 'rounded-[6px]' : 'rounded-full'
                  } ${
                    checked
                      ? 'border-accent bg-grad text-white'
                      : 'border-line-2 bg-white text-transparent'
                  } peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-2`}
                  aria-hidden
                >
                  <Check size={13} strokeWidth={3} />
                </span>
                <span
                  className={`text-[15px] leading-[1.35] ${checked ? 'text-ink font-medium' : 'text-ink'}`}
                >
                  {opt.label}
                </span>
              </label>
            );
          })}
        </div>
      )}

      {question.type === 'multi' && question.maxSelect && (
        <p className="text-[12.5px] text-muted mt-3">
          {multiValues.length}/{question.maxSelect} selecionados
          {maxed ? '. Desmarque um para trocar.' : '.'}
        </p>
      )}
    </fieldset>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * Passo de contato + consentimento
 * ══════════════════════════════════════════════════════════════════════════ */
function ContactStep({
  contact,
  setContact,
  errors,
  onSubmit,
  submitting,
}: {
  contact: ContactData;
  setContact: React.Dispatch<React.SetStateAction<ContactData>>;
  errors: Record<string, string>;
  onSubmit: (evt: React.FormEvent) => void;
  submitting: boolean;
}) {
  const field =
    'w-full rounded-[14px] border bg-white px-4 py-3 text-[15px] text-ink placeholder:text-muted-2 focus:outline-none focus:border-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1';

  return (
    <form onSubmit={onSubmit} noValidate>
      <h2 className="text-[20px] sm:text-[23px] font-semibold text-ink tracking-[-0.02em] mb-2">
        Quase lá. Para quem é este diagnóstico?
      </h2>
      <p className="text-[14px] text-muted leading-[1.5] mb-6">
        Preencha para ver o seu relatório personalizado na tela e receber uma cópia por e-mail.
      </p>

      <div className="grid gap-4">
        <div>
          <label htmlFor="empresa" className="block text-[13.5px] font-medium text-ink mb-1.5">
            Nome da empresa <span className="text-accent">*</span>
          </label>
          <input
            id="empresa"
            type="text"
            value={contact.empresa}
            onChange={(e) => setContact((c) => ({ ...c, empresa: e.target.value }))}
            className={`${field} ${errors.empresa ? 'border-red-400' : 'border-line'}`}
            placeholder="Sua empresa"
            aria-required="true"
            aria-invalid={!!errors.empresa}
            aria-describedby={errors.empresa ? 'empresa-err' : undefined}
            autoComplete="organization"
          />
          {errors.empresa && (
            <p id="empresa-err" role="alert" className="text-[12.5px] text-red-500 mt-1">
              {errors.empresa}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="contato" className="block text-[13.5px] font-medium text-ink mb-1.5">
            Seu nome <span className="text-accent">*</span>
          </label>
          <input
            id="contato"
            type="text"
            value={contact.contato}
            onChange={(e) => setContact((c) => ({ ...c, contato: e.target.value }))}
            className={`${field} ${errors.contato ? 'border-red-400' : 'border-line'}`}
            placeholder="Como podemos te chamar"
            aria-required="true"
            aria-invalid={!!errors.contato}
            aria-describedby={errors.contato ? 'contato-err' : undefined}
            autoComplete="name"
          />
          {errors.contato && (
            <p id="contato-err" role="alert" className="text-[12.5px] text-red-500 mt-1">
              {errors.contato}
            </p>
          )}
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="email" className="block text-[13.5px] font-medium text-ink mb-1.5">
              E-mail <span className="text-accent">*</span>
            </label>
            <input
              id="email"
              type="email"
              value={contact.email}
              onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))}
              className={`${field} ${errors.email ? 'border-red-400' : 'border-line'}`}
              placeholder="voce@empresa.com.br"
              aria-required="true"
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? 'email-err' : undefined}
              autoComplete="email"
            />
            {errors.email && (
              <p id="email-err" role="alert" className="text-[12.5px] text-red-500 mt-1">
                {errors.email}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="telefone" className="block text-[13.5px] font-medium text-ink mb-1.5">
              Telefone <span className="text-muted font-normal">(opcional)</span>
            </label>
            <input
              id="telefone"
              type="tel"
              value={contact.telefone}
              onChange={(e) => setContact((c) => ({ ...c, telefone: e.target.value }))}
              className={`${field} border-line`}
              placeholder="(11) 90000-0000"
              autoComplete="tel"
            />
          </div>
        </div>

        {/* Consentimento LGPD */}
        <div>
          <label
            htmlFor="consent"
            className={`flex items-start gap-3 rounded-[14px] border px-4 py-3.5 cursor-pointer transition-colors ${
              errors.consent ? 'border-red-400' : contact.consent ? 'border-accent bg-accent-soft' : 'border-line'
            }`}
          >
            <input
              id="consent"
              type="checkbox"
              checked={contact.consent}
              onChange={(e) => setContact((c) => ({ ...c, consent: e.target.checked }))}
              className="peer sr-only"
              aria-required="true"
              aria-invalid={!!errors.consent}
              aria-describedby={errors.consent ? 'consent-err' : undefined}
            />
            <span
              className={`flex-shrink-0 w-5 h-5 mt-0.5 rounded-[6px] border flex items-center justify-center ${
                contact.consent ? 'border-accent bg-grad text-white' : 'border-line-2 bg-white text-transparent'
              } peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-2`}
              aria-hidden
            >
              <Check size={13} strokeWidth={3} />
            </span>
            <span className="text-[13.5px] text-ink leading-[1.5]">
              Autorizo a ZappIQ a usar meus dados para gerar o relatório e entrar em contato sobre o
              resultado. <span className="text-accent">*</span>
            </span>
          </label>
          {errors.consent && (
            <p id="consent-err" role="alert" className="text-[12.5px] text-red-500 mt-1">
              {errors.consent}
            </p>
          )}
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="btn btn-accent btn-lg w-full justify-center mt-7 disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
      >
        {submitting ? (
          <>
            <Loader2 size={18} className="animate-spin" aria-hidden /> Gerando relatório...
          </>
        ) : (
          <>
            Ver meu plano ideal <Sparkles size={18} aria-hidden />
          </>
        )}
      </button>
    </form>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * Relatório
 * ══════════════════════════════════════════════════════════════════════════ */
function ReportView({
  rec,
  contato,
  empresa,
  perfil,
  onRestart,
}: {
  rec: Recommendation;
  contato: string;
  empresa: string;
  perfil: { rotulo: string; valor: string }[];
  onRestart: () => void;
}) {
  const primeiroNome = contato.trim().split(/\s+/)[0] || 'tudo bem';

  return (
    <section className="pb-20 lg:pb-28 pt-2">
      <div className="zappiq-wrap">
        <div className="max-w-[940px] mx-auto">
          {/* Saudação */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-bg-soft border border-line text-[12px] text-muted mb-5">
              <span className="w-2 h-2 rounded-full bg-grad" />
              Seu diagnóstico está pronto
            </div>
            <h1 className="text-[30px] sm:text-[38px] lg:text-[44px] leading-[1.08] tracking-[-0.035em] font-semibold text-ink mb-3">
              {primeiroNome}, para a <span className="text-grad">{empresa || 'sua operação'}</span> o
              caminho é o plano {rec.planoNome}.
            </h1>
            <p className="text-[16px] lg:text-[17px] text-muted leading-[1.55] max-w-[620px] mx-auto">
              Montamos a recomendação a partir das suas respostas sobre {rec.segLabel}. Veja o que faz
              sentido para o seu momento.
            </p>
          </div>

          {/* Seu perfil */}
          {perfil.length > 0 && (
            <div className="mb-8">
              <h2 className="text-[13px] font-semibold uppercase tracking-wider text-accent mb-3">
                O seu perfil
              </h2>
              <div className="grid sm:grid-cols-3 gap-3">
                {perfil.map((p) => (
                  <div key={p.rotulo} className="bg-bg-soft border border-line rounded-[16px] p-4">
                    <div className="text-[12px] text-muted mb-1">{p.rotulo}</div>
                    <div className="text-[14.5px] font-medium text-ink leading-[1.4]">{p.valor}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Card do plano ideal */}
          <div className="relative bg-white border border-line rounded-[24px] p-6 sm:p-8 shadow-[var(--shadow-card)] overflow-hidden mb-8">
            <div
              className="absolute inset-x-0 top-0 h-1.5"
              style={{ background: 'linear-gradient(135deg,#2FB57A,#2F7FB5,#4A52D0)' }}
              aria-hidden
            />
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
              <div>
                <div className="text-[12.5px] font-semibold uppercase tracking-wider text-accent mb-1.5">
                  Plano ideal para você
                </div>
                <h2 className="text-[30px] sm:text-[34px] font-semibold text-ink tracking-[-0.02em] leading-none mb-2">
                  {rec.planoNome}
                </h2>
                <p className="text-[15px] text-muted leading-[1.55] max-w-[520px]">{rec.planoEssencia}</p>
              </div>
              <div className="flex-shrink-0">
                <div className="inline-flex items-center rounded-[14px] bg-bg-soft border border-line px-4 py-2.5 text-[15px] font-semibold text-ink">
                  {rec.planoPreco}
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Incluso */}
              <div>
                <div className="text-[13px] font-semibold text-ink mb-3">O que está incluído</div>
                <ul className="grid gap-2">
                  {rec.incluso.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-[14.5px] text-muted leading-[1.45]">
                      <Check size={16} strokeWidth={2.5} className="text-g1 flex-shrink-0 mt-0.5" aria-hidden />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Motivos */}
              {rec.motivos.length > 0 && (
                <div>
                  <div className="text-[13px] font-semibold text-ink mb-3">Por que este plano</div>
                  <ul className="grid gap-2.5">
                    {rec.motivos.map((m, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2.5 text-[14px] text-ink leading-[1.5] bg-accent-soft rounded-[12px] px-3.5 py-2.5"
                      >
                        <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-grad mt-2" aria-hidden />
                        <span>{m}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Produtos */}
          {rec.produtos.length > 0 && (
            <div className="mb-8">
              <h2 className="text-[22px] sm:text-[26px] font-semibold text-ink tracking-[-0.02em] mb-1.5">
                Os produtos que trabalham por você
              </h2>
              <p className="text-[15px] text-muted leading-[1.55] mb-5 max-w-[640px]">
                Selecionados a partir do que você quer resolver. Tudo dentro da mesma plataforma.
              </p>
              <div className="grid sm:grid-cols-2 gap-4">
                {rec.produtos.map((p) => (
                  <div
                    key={p.nome}
                    className="bg-white border border-line rounded-[18px] p-5 shadow-[var(--shadow-card)] transition-transform duration-300 hover:-translate-y-0.5"
                  >
                    <h3 className="text-[17px] font-semibold text-ink mb-2 tracking-[-0.01em]">{p.nome}</h3>
                    <p className="text-[14px] text-muted leading-[1.55] mb-3">{p.caracteristica}</p>
                    <p className="text-[13.5px] text-ink leading-[1.5] pt-3 border-t border-line">{p.casoUso}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add-ons */}
          {rec.addons.length > 0 && (
            <div className="mb-8">
              <h2 className="text-[22px] sm:text-[26px] font-semibold text-ink tracking-[-0.02em] mb-1.5">
                Add-ons que fazem sentido agora
              </h2>
              <p className="text-[15px] text-muted leading-[1.55] mb-5 max-w-[640px]">
                Complementos opcionais, ligados ao que você marcou. Você ativa quando quiser.
              </p>
              <div className="grid gap-3">
                {rec.addons.map((a) => (
                  <div
                    key={a.nome}
                    className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5 bg-bg-soft border border-line rounded-[16px] p-4 sm:p-5"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-[16px] font-semibold text-ink">{a.nome}</h3>
                        <span className="text-[11px] font-medium uppercase tracking-wider text-accent bg-white border border-line rounded-full px-2 py-0.5">
                          {a.modulo}
                        </span>
                      </div>
                      <p className="text-[13.5px] text-muted leading-[1.5]">{a.motivo}</p>
                    </div>
                    <div className="flex-shrink-0 text-[14.5px] font-semibold text-ink">{a.preco}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CTA final */}
          <div className="bg-white border border-line rounded-[24px] p-8 sm:p-10 text-center shadow-[var(--shadow-card)]">
            <h2 className="text-[24px] sm:text-[30px] font-semibold text-ink tracking-[-0.025em] leading-[1.15] mb-3">
              Pronto para colocar o plano {rec.planoNome} para rodar?
            </h2>
            <p className="text-[15px] lg:text-[16px] text-muted leading-[1.55] max-w-[520px] mx-auto mb-7">
              {rec.cta.tipo === 'trial'
                ? 'Ative em minutos e teste 14 dias grátis, sem cartão. Você aprova, a Iza executa.'
                : 'Um especialista monta com você um contrato sob medida para o porte da sua operação.'}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href={rec.cta.href}
                className="btn btn-accent btn-lg focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
              >
                {rec.cta.label} <ArrowRight size={18} aria-hidden />
              </Link>
              <button
                type="button"
                onClick={onRestart}
                className="btn btn-line btn-lg focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
              >
                <RotateCcw size={17} aria-hidden /> Refazer o diagnóstico
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
