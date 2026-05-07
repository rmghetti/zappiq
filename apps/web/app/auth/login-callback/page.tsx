'use client';

/* ══════════════════════════════════════════════════════════════════════════
 * /auth/login-callback — PR #102
 * --------------------------------------------------------------------------
 * Page client-side que recebe redirect pós-Google OAuth ou pós-Magic Link.
 *
 * Detecta 2 fluxos:
 *   1. PKCE OAuth Google → ?code=... no querystring
 *   2. Magic Link → #access_token=...&refresh_token=... no hash (implicit)
 *
 * Em ambos os casos:
 *   - Pega/troca por sessão Supabase válida
 *   - Manda access_token pro backend Express /api/auth/passwordless-exchange
 *   - Backend valida JWT, busca User Prisma pelo email, retorna JWT nosso
 *   - Frontend salva JWT nosso em localStorage e vai pra /dashboard
 *
 * Se user não existe no Prisma (Supabase user OK mas onboarding incompleto),
 * redireciona pra /onboarding. Se erro de rede/server, mostra erro + retry.
 * ══════════════════════════════════════════════════════════════════════════ */

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Loader2, AlertCircle } from 'lucide-react';
import { Logo } from '../../../components/Logo';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || 'https://zappiq-api.fly.dev';

export default function LoginCallbackPage() {
  const router = useRouter();
  const search = useSearchParams();
  const [status, setStatus] = useState<'processing' | 'error' | 'no_account'>('processing');
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    void finalize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function finalize() {
    try {
      let accessToken: string | null = null;
      let refreshToken: string | null = null;

      // Fluxo 1 — PKCE OAuth Google: ?code=...
      const code = search.get('code');
      if (code) {
        const res = await fetch('/api/auth/exchange-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        });
        const j = await res.json();
        if (!res.ok || !j.access_token) {
          throw new Error(j.error || 'Falha ao trocar code por sessão');
        }
        accessToken = j.access_token;
        refreshToken = j.refresh_token || null;
      }

      // Fluxo 2 — Magic Link implicit: #access_token=...
      if (!accessToken && typeof window !== 'undefined') {
        const hash = window.location.hash;
        if (hash && hash.includes('access_token=')) {
          const params = new URLSearchParams(hash.replace(/^#/, ''));
          accessToken = params.get('access_token');
          refreshToken = params.get('refresh_token');
        }
      }

      if (!accessToken) {
        throw new Error('Sessão Supabase não encontrada — link inválido ou expirado');
      }

      // Limpa hash da URL (não vazar tokens)
      if (typeof window !== 'undefined' && window.location.hash) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }

      // Troca pelo JWT nosso via backend Express
      const exchangeRes = await fetch(`${API_BASE}/api/auth/passwordless-exchange`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: accessToken, refresh_token: refreshToken }),
      });

      const exchange = await exchangeRes.json();

      if (exchangeRes.status === 404) {
        // Supabase user OK mas User do Prisma não existe → onboarding incompleto
        setStatus('no_account');
        return;
      }

      if (!exchangeRes.ok || !exchange.token || !exchange.user) {
        throw new Error(exchange.error || 'Falha ao trocar sessão');
      }

      // Salva JWT nosso e redireciona pro dashboard
      localStorage.setItem('zappiq_token', exchange.token);
      if (exchange.refreshToken) {
        localStorage.setItem('zappiq_refresh_token', exchange.refreshToken);
      }

      router.replace('/dashboard');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      console.error('[login-callback] Finalize failed:', err);
      setErrorMsg(msg);
      setStatus('error');
    }
  }

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
          {status === 'processing' && (
            <>
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-50 mb-5">
                <Loader2 size={28} className="text-primary-500 animate-spin" />
              </div>
              <h2 className="text-xl font-semibold text-text-primary mb-2">Entrando...</h2>
              <p className="text-sm text-text-secondary">Validando sessão e abrindo seu dashboard.</p>
            </>
          )}

          {status === 'no_account' && (
            <>
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-yellow-50 mb-5">
                <AlertCircle size={28} className="text-yellow-600" />
              </div>
              <h2 className="text-xl font-semibold text-text-primary mb-2">Onboarding incompleto</h2>
              <p className="text-sm text-text-secondary leading-relaxed mb-6">
                Sua conta foi criada, mas o onboarding ainda não foi finalizado. Vamos te levar pra lá.
              </p>
              <button
                onClick={() => router.push('/onboarding?from=login_callback')}
                className="w-full bg-primary-500 text-white py-2.5 rounded-lg font-medium hover:bg-primary-600 transition-colors"
              >
                Continuar onboarding
              </button>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-50 mb-5">
                <AlertCircle size={28} className="text-red-600" />
              </div>
              <h2 className="text-xl font-semibold text-text-primary mb-2">Não conseguimos entrar</h2>
              <p className="text-sm text-text-secondary leading-relaxed mb-2">
                {errorMsg || 'Erro inesperado'}
              </p>
              <p className="text-xs text-text-secondary/70 mb-6">
                O link pode ter expirado ou já ter sido usado. Tente entrar novamente.
              </p>
              <Link
                href="/login"
                className="block w-full bg-primary-500 text-white py-2.5 rounded-lg font-medium hover:bg-primary-600 transition-colors"
              >
                Voltar ao login
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
