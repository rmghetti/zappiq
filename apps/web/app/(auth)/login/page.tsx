'use client';

/* ══════════════════════════════════════════════════════════════════════════
 * /login — PR #102 (Auth Login Resilience)
 * --------------------------------------------------------------------------
 * Refactor pra 3 caminhos refletindo a realidade do produto (passwordless-first):
 *   1. Continuar com Google (OAuth) — pra quem cadastrou via Google
 *   2. Receber link mágico no e-mail — funciona pra QUALQUER cliente
 *   3. Email + Senha (collapse "Entrar com senha") — fallback opcional
 *
 * P0 fixes:
 *   - P0 #1 do audit: faltava Google no /login
 *   - P0 #2 do audit: cliente que entrou via Magic Link/OAuth tem senha
 *     aleatória 32 chars no Supabase (gerada no /onboarding) → não conhecia.
 *     Agora pode entrar via Magic Link sem precisar lembrar senha.
 *   - "Esqueci minha senha" → /recuperar-senha (rota nova nesta PR)
 * ══════════════════════════════════════════════════════════════════════════ */

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Loader2, Mail, Lock, ChevronDown, AlertCircle, CheckCircle2, ArrowRight, Info } from 'lucide-react';
import { useAuthStore } from '../../../stores/authStore';
import { Logo } from '../../../components/Logo';

type Mode = 'choose' | 'magic_sent' | 'password_form';

function LoginInner() {
  const router = useRouter();
  const search = useSearchParams();
  const { login } = useAuthStore();
  const [mode, setMode] = useState<Mode>('choose');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  // PR #103.4 — Banner explicativo quando vem do /onboarding com 409
  // (cliente JA tinha conta e tentou completar onboarding de novo).
  useEffect(() => {
    const reason = search.get('reason');
    if (reason === 'already_registered') {
      setInfo('Você já tem conta no ZappIQ. Entre com Google ou link mágico pra acessar seu dashboard.');
    }
  }, [search]);

  // ─── Google OAuth login ──────────────────────────────────────────
  async function handleGoogle() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/login/google', { method: 'POST' });
      const j = await res.json();
      if (j.url) {
        window.location.href = j.url;
        return;
      }
      throw new Error(j.error || 'Falha ao iniciar Google OAuth');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro Google OAuth';
      setError(msg);
      setLoading(false);
    }
  }

  // ─── Magic Link login ────────────────────────────────────────────
  async function handleMagic(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      setError('Digite seu e-mail');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/login/magic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Falha ao enviar link');
      setMode('magic_sent');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao enviar link mágico';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  // ─── Senha login (fallback) ──────────────────────────────────────
  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao fazer login';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  // ─── Estado: link mágico enviado ─────────────────────────────────
  if (mode === 'magic_sent') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <Link href="/" className="inline-flex items-center justify-center gap-2 lg:gap-2.5 mb-3">
              <Logo variant="positivo" height={48} />
              <Image src="/partners/machia/patch-machia.svg" alt="A Platform MACHIA Company" width={48} height={52} priority className="h-12 w-auto" />
            </Link>
          </div>
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-50 mb-5">
              <Mail size={28} className="text-primary-500" />
            </div>
            <h2 className="text-xl font-semibold text-text-primary mb-2">
              Link enviado pra <span className="text-primary-500">{email}</span>
            </h2>
            <p className="text-sm text-text-secondary leading-relaxed mb-6">
              Abra a caixa de entrada e clique em &ldquo;Entrar no ZappIQ&rdquo;. O link expira em 30 minutos.
            </p>
            <div className="bg-gray-50 rounded-xl p-4 text-left mb-6">
              <p className="text-xs font-semibold text-text-primary mb-2">Não chegou?</p>
              <ul className="text-xs text-text-secondary space-y-1">
                <li>• Verifique spam/lixo eletrônico</li>
                <li>• Confirme que digitou o e-mail correto</li>
                <li>• Aguarde até 1 minuto</li>
              </ul>
            </div>
            <button
              onClick={() => { setMode('choose'); setError(''); }}
              className="text-sm text-text-secondary hover:text-primary-500 underline underline-offset-2"
            >
              Voltar e usar outro e-mail
            </button>
          </div>
          <p className="text-center text-xs text-gray-400 mt-6">ZappIQ © 2026 · uma plataforma MACHIA</p>
        </div>
      </div>
    );
  }

  // ─── Estado: escolha de método ───────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 lg:gap-2.5 mb-3"
            aria-label="ZappIQ — uma plataforma da MACHIA"
          >
            <Logo variant="positivo" height={48} />
            <Image
              src="/partners/machia/patch-machia.svg"
              alt="A Platform MACHIA Company"
              width={48}
              height={52}
              priority
              className="h-12 w-auto"
            />
          </Link>
          <p className="text-text-secondary mt-2">Acesse sua plataforma de atendimento inteligente</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8 space-y-4">
          {info && (
            <div className="flex items-start gap-2 bg-blue-50 text-blue-800 px-4 py-3 rounded-lg text-sm border border-blue-200">
              <Info size={16} className="mt-0.5 flex-shrink-0" />
              <span>{info}</span>
            </div>
          )}
          {error && (
            <div className="flex items-start gap-2 bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Google OAuth */}
          <button
            type="button"
            onClick={handleGoogle}
            disabled={loading}
            className="w-full bg-white border border-gray-300 text-text-primary rounded-lg py-3 font-medium hover:border-primary-500 hover:bg-gray-50 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
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
          <div className="flex items-center gap-3 my-2">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-[11px] text-gray-400 uppercase tracking-wider">ou</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* Magic Link form */}
          <form onSubmit={handleMagic} className="space-y-3">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-text-primary mb-1.5">E-mail</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-colors"
                placeholder="seu@email.com"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary-500 text-white py-2.5 rounded-lg font-medium hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
              {loading ? 'Enviando...' : 'Receber link no e-mail'}
            </button>
            <p className="text-[11.5px] text-text-secondary/80 text-center leading-relaxed">
              Sem senha. Clica no link que chega no e-mail e entra direto.
            </p>
          </form>

          {/* Senha (collapse) */}
          {mode === 'choose' && (
            <button
              type="button"
              onClick={() => setMode('password_form')}
              className="w-full flex items-center justify-center gap-2 text-sm text-text-secondary hover:text-primary-500 transition-colors py-2"
            >
              <Lock size={14} />
              Entrar com senha
              <ChevronDown size={14} />
            </button>
          )}

          {mode === 'password_form' && (
            <form onSubmit={handlePassword} className="space-y-3 pt-2 border-t border-gray-100">
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-text-primary mb-1.5">Senha</label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-colors"
                  placeholder="••••••••"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-text-primary text-white py-2.5 rounded-lg font-medium hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                {loading ? 'Entrando...' : 'Entrar com senha'}
              </button>
              <div className="flex items-center justify-between text-xs">
                <Link href="/recuperar-senha" className="text-text-secondary hover:text-primary-500 underline underline-offset-2">
                  Esqueci ou não tenho senha
                </Link>
                <button
                  type="button"
                  onClick={() => { setMode('choose'); setPassword(''); setError(''); }}
                  className="text-text-secondary hover:text-text-primary"
                >
                  Voltar
                </button>
              </div>
            </form>
          )}

          <p className="text-center text-sm text-text-secondary pt-2 border-t border-gray-100">
            Não tem conta?{' '}
            <Link href="/cadastro" className="text-primary-500 font-medium hover:underline">
              Começar 14 dias grátis
            </Link>
          </p>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">ZappIQ © 2026 · uma plataforma MACHIA 🇧🇷</p>
      </div>
    </div>
  );
}

// PR #103.4 — Suspense boundary obrigatório porque LoginInner usa useSearchParams.
// Mesmo padrão do /auth/login-callback — Next.js 14 App Router exige.
export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 size={28} className="animate-spin text-primary-500" />
      </div>
    }>
      <LoginInner />
    </Suspense>
  );
}
