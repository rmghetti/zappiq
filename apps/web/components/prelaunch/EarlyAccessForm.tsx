'use client';

/* ══════════════════════════════════════════════════════════════════════════
 * EarlyAccessForm: V5.3
 * --------------------------------------------------------------------------
 * Form de captura de leads pra lista Fundadores. POST /api/leads.
 * Estado: idle → submitting → success | error.
 * Em caso de erro, mostra mensagem amigável e mantém o form pra retry.
 * Cliente-side faz validação de email + dispara fetch sem bloquear UI.
 * ══════════════════════════════════════════════════════════════════════════ */

import { useState, type FormEvent } from 'react';
import s from './prelaunch.module.css';

type State = 'idle' | 'submitting' | 'success' | 'error';

export function EarlyAccessForm() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<State>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (state === 'submitting') return;

    const trimmed = email.trim();
    if (!trimmed || !/.+@.+\..+/.test(trimmed)) {
      setState('error');
      setErrorMsg('E-mail inválido. Confirme e tente de novo.');
      return;
    }

    setState('submitting');
    setErrorMsg('');

    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: trimmed,
          source: 'prelaunch_v53',
          ts: new Date().toISOString(),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Erro inesperado' }));
        throw new Error(body.error || `HTTP ${res.status}`);
      }

      setState('success');
    } catch (err) {
      setState('error');
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Não consegui registrar agora. Tenta de novo em alguns segundos.',
      );
    }
  };

  return (
    <section id="notify">
      <div className={s.shell}>
        <div className={s.ctaBlock}>
          <div className={s.ctaLeftC}>
            <h3 className={s.ctaH3}>
              Entre na lista <em className={s.ctaEm}>Fundadores.</em>
              <br />
              Saia na frente do seu concorrente.
            </h3>
            <p className={s.ctaP}>
              Os primeiros inscritos recebem acesso antecipado, <strong>50% de desconto no primeiro ano</strong> e
              canal direto com nosso time de produto. Vagas limitadas até 04 de maio.
            </p>
          </div>

          <form
            className={s.notifyForm}
            onSubmit={handleSubmit}
            noValidate
            aria-label="Reservar vaga early access"
          >
            {state !== 'success' && (
              <>
                <div className={s.notifyField}>
                  <input
                    type="email"
                    placeholder="seu@email.com.br"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    disabled={state === 'submitting'}
                    aria-label="Seu e-mail"
                  />
                  <button type="submit" disabled={state === 'submitting'}>
                    {state === 'submitting' ? 'Reservando…' : 'Reservar minha vaga'}
                  </button>
                </div>
                <div className={s.notifyMicroRow}>
                  <span>
                    <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M2 7l3 3 7-7" />
                    </svg>
                    Sem spam
                  </span>
                  <span>
                    <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M2 7l3 3 7-7" />
                    </svg>
                    1 e-mail no lançamento
                  </span>
                  <span>
                    <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M2 7l3 3 7-7" />
                    </svg>
                    LGPD compliant
                  </span>
                </div>
                {state === 'error' && (
                  <div className={s.errorMsg} role="alert">
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="9" cy="9" r="7" />
                      <path d="M9 5v4M9 12v.5" />
                    </svg>
                    <span>{errorMsg || 'Algo falhou. Tenta de novo.'}</span>
                  </div>
                )}
              </>
            )}

            {state === 'success' && (
              <div className={`${s.successMsg} ${s.successMsgShow}`} role="status">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="9" cy="9" r="7" />
                  <path d="M5 9l3 3 5-6" />
                </svg>
                <span>Vaga reservada. Te avisamos no dia 04.05, fique de olho na sua caixa.</span>
              </div>
            )}
          </form>
        </div>
      </div>
    </section>
  );
}
