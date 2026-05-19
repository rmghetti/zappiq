'use client';

/* ══════════════════════════════════════════════════════════════════════════
 * Cadastro — Self-Signup Wizard V4 (Chatbase-style · Geist + g→b→p)
 * --------------------------------------------------------------------------
 * Wizard 3 steps:
 *   Step 1 — Dados básicos (nome, e-mail, plano) + Google OAuth alternativo
 *   Step 2 — Aguarde Magic Link (e-mail confirmation)
 *   Step 3 — Escolha caminho onboarding (Assistido → /agendar / Self-service)
 *
 * Decisões aplicadas (memory: project_self_signup_decisions):
 *   - Auth: Magic Link Supabase + Google OAuth (sem WhatsApp OTP)
 *   - CNPJ: opcional no signup (obrigatório só no /onboarding)
 *   - Schema: tabela `signups` nova (não reusa early_access_leads)
 *   - Trial: 14 dias, cartão exigido em D+14
 *   - Plano default: Growth (R$ 497) pré-selecionado
 * ══════════════════════════════════════════════════════════════════════════ */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowRight, CheckCircle2, Mail, Calendar, Rocket,
  Users, Wrench, Loader2, AlertCircle, Sparkles,
} from 'lucide-react';
import { PLAN_CONFIG, type PlanId } from '@zappiq/shared';
import { track, getUtm } from '@/lib/analytics';

type Step = 1 | 2 | 3;

interface FormData {
  name: string;
  email: string;
  plan: PlanId;
  cnpj: string;
  company: string;
}

const PLAN_OPTIONS: { id: PlanId; label: string; price: string; sub: string; highlight?: boolean }[] = [
  { id: 'STARTER', label: 'Starter', price: 'R$ 197', sub: 'Para começar' },
  { id: 'GROWTH', label: 'Growth', price: 'R$ 497', sub: 'Mais escolhido', highlight: true },
  { id: 'SCALE', label: 'Scale', price: 'R$ 997', sub: 'Para crescer' },
  { id: 'BUSINESS', label: 'Business', price: 'R$ 1.997', sub: 'Operação crítica' },
];

// ═══════════════════════════════════════════════════════════════════
export function Cadastro() {
  const router = useRouter();
  const search = useSearchParams();
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>({
    name: '',
    email: '',
    plan: 'GROWTH', // pré-selecionado
    cnpj: '',
    company: '',
  });

  // Analytics: page view
  useEffect(() => {
    track('cadastro_view');
  }, []);

  // Detecta retorno de magic link / OAuth callback
  useEffect(() => {
    const verified = search.get('verified');
    if (verified === '1') {
      setStep(3);
    }
  }, [search]);

  // Processa tokens do hash (implicit flow do Supabase).
  // 2 fluxos suportados (PR #92):
  //   1. Magic Link Confirm Signup: `#access_token=...&type=signup`
  //   2. OAuth Google: `#access_token=...&provider_token=...` (sem type)
  // Em ambos casos: avança UX pro step 3, limpa hash, manda tokens pro
  // backend que faz UPSERT em signups (cria se OAuth, atualiza se magic).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash;
    if (!hash || !hash.includes('access_token=')) return;

    const params = new URLSearchParams(hash.replace(/^#/, ''));
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const type = params.get('type');
    const providerToken = params.get('provider_token');

    if (!accessToken) return;

    // Aceita Magic Link (type=signup) OU OAuth (provider_token presente)
    const isValidAuthFlow = type === 'signup' || providerToken !== null;
    if (!isValidAuthFlow) return;

    // PR #101.3 — Decodifica JWT Supabase pra extrair email/name e salvar
    // em localStorage. /onboarding useEffect lê e pula Step 0 ("Crie sua conta")
    // pre-populando os dados — elimina P0 #2 do audit (signup duplicado).
    try {
      const jwtPayload = JSON.parse(atob(accessToken.split('.')[1]));
      const sbEmail = jwtPayload.email || '';
      const meta = jwtPayload.user_metadata || {};
      const sbName = meta.full_name || meta.name || (sbEmail ? sbEmail.split('@')[0] : '');
      if (sbEmail) {
        localStorage.setItem('zappiq_oauth_email', sbEmail);
        localStorage.setItem('zappiq_oauth_name', sbName);
        localStorage.setItem('zappiq_oauth_provider', providerToken !== null ? 'google' : 'magic_link');
        // HOTFIX 2026-05-19 — persistir access_token Supabase pra /onboarding usar
        // ao chamar /api/auth/set-password (caminho magic_link). TTL ~1h
        // (Supabase JWT default), cliente termina onboarding antes disso na pratica.
        localStorage.setItem('zappiq_supabase_access_token', accessToken);
        if (refreshToken) localStorage.setItem('zappiq_supabase_refresh_token', refreshToken);
      }
    } catch (err) {
      console.error('[cadastro] JWT decode failed:', err);
    }

    // Analytics: confirm event (distingue Magic Link de OAuth)
    if (providerToken !== null) {
      track('signup_oauth_completed', { provider: 'google' });
    } else {
      track('signup_email_confirmed', { provider: 'email' });
    }

    // PR #105 — Tentativa LOGIN RETORNO antes de signup flow.
    // Quando cliente já tem conta (User + Org Prisma), Supabase OAuth retorna
    // pra /cadastro?verified=1 mesmo sendo login (bug arquitetural com user
    // existente). Fix: chama passwordless-exchange ANTES de setStep(3).
    // Se 200 → cliente já existe → salva JWT + redirect /dashboard.
    // Se 404 → no_account → segue flow signup atual.
    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://zappiq-api.fly.dev';
    void (async () => {
      try {
        const exchangeRes = await fetch(`${API_BASE}/api/auth/passwordless-exchange`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ access_token: accessToken, refresh_token: refreshToken }),
        });
        if (exchangeRes.ok) {
          const ex = await exchangeRes.json();
          if (ex.token && ex.user) {
            localStorage.setItem('zappiq_token', ex.token);
            if (ex.refreshToken) {
              localStorage.setItem('zappiq_refresh_token', ex.refreshToken);
            }
            // Limpa hash + redireciona pro dashboard
            const cleanUrl = window.location.pathname;
            window.history.replaceState({}, document.title, cleanUrl);
            window.location.replace('/dashboard');
            return;
          }
        }
        // 404 ou outro erro: fallback pro signup flow
        if (exchangeRes.status !== 404) {
          console.warn('[cadastro] passwordless-exchange unexpected status:', exchangeRes.status);
        }
      } catch (err) {
        console.warn('[cadastro] passwordless-exchange failed, falling back to signup:', err);
      }

      // FALLBACK — flow signup atual (cliente novo)
      setStep(3);

      // Limpa hash da URL pra não vazar tokens em logs/screenshots
      const cleanUrl = window.location.pathname + window.location.search;
      window.history.replaceState({}, document.title, cleanUrl);

      // Lê plan da query string (passado pelo OAuth flow via /api/signup/google)
      const planFromQuery = search.get('plan') || undefined;

      // UTM first-touch (PR #94) — pra OAuth path, pegamos do storage
      // e mandamos pro confirm-signup que faz UPSERT incluindo as colunas.
      const utm = getUtm();

      // Atualiza signup status no backend (fire-and-forget)
      // Backend faz UPSERT: cria row se OAuth (sem signup pré-criado),
      // atualiza se Magic Link (row já existe).
      fetch('/api/auth/confirm-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token: accessToken,
          refresh_token: refreshToken,
          plan: planFromQuery,
          utm_source: utm.utm_source || null,
          utm_medium: utm.utm_medium || null,
          utm_campaign: utm.utm_campaign || null,
        }),
      }).catch((err) => {
        console.error('[cadastro] Confirm signup background error:', err);
      });
    })();
  }, [search]);

  // ─── Step 1 → submit ───
  const submitStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Analytics: step 1 submit (props sanitizadas — sem PII direto)
    track('signup_step_1_submit', {
      plan: form.plan,
      hasCnpj: form.cnpj.trim().length > 0,
      hasCompany: form.company.trim().length > 0,
    });

    try {
      const utm = getUtm();
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          plan: form.plan,
          cnpj: form.cnpj.trim() || null,
          company: form.company.trim() || null,
          // UTM first-touch attribution (PR #94)
          utm_source: utm.utm_source || null,
          utm_medium: utm.utm_medium || null,
          utm_campaign: utm.utm_campaign || null,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || 'Erro ao processar cadastro');
      }
      // Analytics: magic link disparado com sucesso
      track('signup_email_link_sent', { plan: form.plan });
      setStep(2);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao processar cadastro';
      setError(msg);
      // Analytics: erro no step 1
      track('signup_step_1_error', { plan: form.plan, error_message: msg.slice(0, 200) });
    } finally {
      setLoading(false);
    }
  };

  // ─── Google OAuth ───
  const startGoogle = async () => {
    setLoading(true);

    // Analytics: OAuth init
    track('signup_oauth_started', { provider: 'google', plan: form.plan });

    try {
      const res = await fetch('/api/signup/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: form.plan }),
      });
      const j = await res.json();
      if (j.url) window.location.href = j.url;
      else throw new Error('Falha ao iniciar Google');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro Google OAuth';
      setError(msg);
      track('signup_oauth_error', { provider: 'google', error_message: msg.slice(0, 200) });
      setLoading(false);
    }
  };

  return (
    <main>
      {/* Hero compacto */}
      <section className="relative overflow-hidden pt-32 pb-8 lg:pt-40 lg:pb-10">
        <div
          className="absolute inset-0 -z-10"
          style={{
            background:
              'radial-gradient(80% 60% at 50% 0%, rgba(47,181,122,.08) 0%, rgba(74,82,208,.06) 45%, transparent 80%)',
          }}
        />
        <div className="zappiq-wrap max-w-3xl text-center">
          <span className="eyebrow">Trial 14 dias · Sem cartão</span>
          <h1 className="text-[36px] lg:text-[52px] font-medium text-ink leading-[1.05] tracking-[-0.035em] mt-4 mb-3">
            {step === 1 && <>Comece em <span className="text-grad">3 minutos.</span></>}
            {step === 2 && <>Confira seu <span className="text-grad">e-mail.</span></>}
            {step === 3 && <>Bem-vindo ao <span className="text-grad">ZappIQ.</span></>}
          </h1>
          <p className="text-[15px] lg:text-[17px] text-muted leading-relaxed max-w-xl mx-auto">
            {step === 1 && 'Sem cartão de crédito. Cancela quando quiser. Cobrança só em D+14, se você decidir continuar.'}
            {step === 2 && 'Enviamos um link mágico pra confirmar seu acesso. Pode levar até 1 minuto.'}
            {step === 3 && 'Conta criada. Agora escolha como quer começar.'}
          </p>
        </div>
      </section>

      {/* Stepper */}
      <section className="pb-8">
        <div className="zappiq-wrap max-w-md">
          <div className="flex items-center justify-between gap-2">
            {[1, 2, 3].map((n) => (
              <div key={n} className="flex-1 flex items-center gap-2">
                <div
                  className={`flex items-center justify-center w-7 h-7 rounded-full text-[12px] font-semibold transition-all ${
                    step >= n
                      ? 'bg-ink text-white'
                      : 'bg-bg-soft text-muted border border-line'
                  }`}
                >
                  {step > n ? <CheckCircle2 size={14} /> : n}
                </div>
                {n < 3 && (
                  <div
                    className={`flex-1 h-[2px] transition-all ${
                      step > n ? 'bg-ink' : 'bg-line'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Conteúdo do step */}
      <section className="pb-24">
        <div className="zappiq-wrap max-w-2xl">
          {/* ─── STEP 1 — Form básico + OAuth ───────────────────── */}
          {step === 1 && (
            <div className="bg-white border border-line rounded-[20px] p-6 lg:p-8 shadow-[var(--shadow-card)]">
              {/* Google OAuth */}
              <button
                onClick={startGoogle}
                disabled={loading}
                className="w-full bg-white border border-line text-ink rounded-[14px] py-3.5 font-medium text-[14.5px] hover:border-accent hover:bg-bg-soft transition-all flex items-center justify-center gap-3 disabled:opacity-50"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                  <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                  <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                  <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                </svg>
                Continuar com Google
              </button>

              {/* Divisor */}
              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px bg-line" />
                <span className="text-[11px] text-muted-2 uppercase tracking-wider">ou</span>
                <div className="flex-1 h-px bg-line" />
              </div>

              {/* Form e-mail */}
              <form onSubmit={submitStep1} className="space-y-4">
                <div>
                  <label className="block text-[13px] font-medium text-ink mb-1.5">
                    Nome completo
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Seu nome"
                    required
                    minLength={2}
                    className="w-full px-4 py-3 bg-white border border-line rounded-[12px] text-[14px] text-ink placeholder:text-muted-2 focus:outline-none focus:border-accent transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-[13px] font-medium text-ink mb-1.5">
                    E-mail corporativo
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="voce@suaempresa.com.br"
                    required
                    className="w-full px-4 py-3 bg-white border border-line rounded-[12px] text-[14px] text-ink placeholder:text-muted-2 focus:outline-none focus:border-accent transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-[13px] font-medium text-ink mb-1.5">
                    Empresa <span className="text-muted-2 font-normal">(opcional)</span>
                  </label>
                  <input
                    type="text"
                    value={form.company}
                    onChange={(e) => setForm({ ...form, company: e.target.value })}
                    placeholder="Razão social ou nome fantasia"
                    className="w-full px-4 py-3 bg-white border border-line rounded-[12px] text-[14px] text-ink placeholder:text-muted-2 focus:outline-none focus:border-accent transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-[13px] font-medium text-ink mb-2">
                    Escolha seu plano
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {PLAN_OPTIONS.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setForm({ ...form, plan: p.id })}
                        className={`relative text-left px-4 py-3 rounded-[12px] border transition-all ${
                          form.plan === p.id
                            ? 'border-accent bg-accent-soft'
                            : 'border-line bg-white hover:border-accent/40'
                        }`}
                      >
                        {p.highlight && (
                          <span className="absolute -top-2 right-2 bg-ink text-white text-[9px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider">
                            Mais escolhido
                          </span>
                        )}
                        <div className="text-[13.5px] font-semibold text-ink">{p.label}</div>
                        <div className="text-[15px] font-bold text-ink mt-0.5">{p.price}<span className="text-[10px] font-normal text-muted">/mês</span></div>
                        <div className="text-[11px] text-muted mt-0.5">{p.sub}</div>
                      </button>
                    ))}
                  </div>
                  <p className="text-[11.5px] text-muted-2 mt-2">
                    Você pode mudar de plano a qualquer momento, sem custo.
                  </p>
                </div>

                {error && (
                  <div className="flex items-start gap-2 px-4 py-3 bg-[#FEE2E2]/50 border-l-[3px] border-l-[#DC2626] rounded-[10px]">
                    <AlertCircle size={15} className="text-[#DC2626] mt-0.5 flex-shrink-0" />
                    <p className="text-[12.5px] text-ink-2">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-ink text-white rounded-[14px] py-3.5 font-medium text-[14.5px] hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      Receber link de acesso por e-mail
                      <ArrowRight size={15} />
                    </>
                  )}
                </button>

                <p className="text-[11px] text-muted-2 text-center">
                  Ao continuar, você concorda com nossos{' '}
                  <Link href="/legal/termos" className="underline underline-offset-2 hover:text-accent">termos</Link>{' '}
                  e{' '}
                  <Link href="/legal/privacidade" className="underline underline-offset-2 hover:text-accent">política de privacidade</Link>.
                </p>
              </form>
            </div>
          )}

          {/* ─── STEP 2 — Confirme e-mail ──────────────────────── */}
          {step === 2 && (
            <div className="bg-white border border-line rounded-[20px] p-8 lg:p-12 text-center shadow-[var(--shadow-card)]">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-accent-soft mb-5">
                <Mail size={28} className="text-accent" />
              </div>
              <h2 className="text-[22px] lg:text-[26px] font-semibold text-ink leading-tight mb-2">
                Link enviado pra <span className="text-accent">{form.email || 'seu e-mail'}</span>.
              </h2>
              <p className="text-[14px] text-muted leading-relaxed max-w-md mx-auto mb-6">
                Abra a caixa de entrada e clique em "Confirmar e entrar". O link expira em 30 minutos.
              </p>
              <div className="bg-bg-soft rounded-[14px] p-5 max-w-md mx-auto text-left mb-6">
                <p className="text-[12.5px] font-semibold text-ink mb-2">Não chegou?</p>
                <ul className="text-[12.5px] text-muted space-y-1.5">
                  <li>• Verifique spam/lixo eletrônico</li>
                  <li>• Confirme que digitou o e-mail correto</li>
                  <li>• Aguarde até 1 minuto (envio assíncrono)</li>
                </ul>
              </div>
              <button
                onClick={() => setStep(1)}
                className="text-[13px] text-muted hover:text-accent transition-colors underline underline-offset-2"
              >
                Voltar e corrigir e-mail
              </button>
            </div>
          )}

          {/* ─── STEP 3 — Escolha caminho onboarding ─────────────── */}
          {step === 3 && (
            <div className="space-y-5">
              <p className="text-[14px] text-muted text-center mb-6">
                Você ganhou 14 dias grátis. Como prefere começar?
              </p>

              {/* Caminho A — Assistido */}
              <Link
                href="/agendar"
                onClick={() => track('signup_path_chosen', { path: 'assistido' })}
                className="block bg-white border-2 border-accent rounded-[20px] p-6 lg:p-7 shadow-[var(--shadow-card)] hover:opacity-95 transition-all"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-[14px] bg-accent-soft flex items-center justify-center">
                    <Users size={22} className="text-accent" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-semibold bg-ink text-white px-2 py-0.5 rounded-full uppercase tracking-wider">
                        Recomendado
                      </span>
                      <span className="text-[10px] text-muted">80% dos clientes escolhem</span>
                    </div>
                    <h3 className="text-[18px] font-semibold text-ink mb-1">Onboarding Assistido</h3>
                    <p className="text-[13.5px] text-muted leading-relaxed mb-3">
                      Especialista ZappIQ configura tudo com você em 30 minutos por videochamada.
                      Sem dor de cabeça técnica.
                    </p>
                    <span className="inline-flex items-center gap-1 text-[13px] font-medium text-accent">
                      Agendar minha call <ArrowRight size={13} />
                    </span>
                  </div>
                </div>
              </Link>

              {/* Caminho B — Self-service */}
              <Link
                href="/onboarding"
                onClick={() => track('signup_path_chosen', { path: 'self_service' })}
                className="block bg-white border border-line rounded-[20px] p-6 lg:p-7 hover:border-accent/40 transition-all"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-[14px] bg-bg-soft flex items-center justify-center">
                    <Rocket size={22} className="text-muted" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-[18px] font-semibold text-ink mb-1">Self-service</h3>
                    <p className="text-[13.5px] text-muted leading-relaxed mb-3">
                      Você configura no seu ritmo. Tutorial guiado, embedded signup Meta,
                      suporte sob demanda quando precisar.
                    </p>
                    <span className="inline-flex items-center gap-1 text-[13px] font-medium text-ink-2">
                      Começar agora <ArrowRight size={13} />
                    </span>
                  </div>
                </div>
              </Link>

              <p className="text-[11.5px] text-muted-2 text-center mt-6">
                Você pode trocar entre caminhos a qualquer momento.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Trust strip footer */}
      {step === 1 && (
        <section className="py-12 bg-bg-soft border-t border-line">
          <div className="zappiq-wrap max-w-4xl">
            <div className="grid sm:grid-cols-3 gap-6 text-center">
              {[
                { icon: CheckCircle2, t: 'Sem cartão', d: 'Trial 14 dias 100% gratuito' },
                { icon: Sparkles, t: 'Sem fidelidade', d: 'Cancela com 1 clique' },
                { icon: Calendar, t: 'No ar em 7 dias', d: 'Onboarding assistido incluso' },
              ].map((item, i) => (
                <div key={i} className="flex flex-col items-center">
                  <item.icon size={20} className="text-[#2FB57A] mb-2" />
                  <p className="text-[14px] font-semibold text-ink">{item.t}</p>
                  <p className="text-[12.5px] text-muted mt-0.5">{item.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
