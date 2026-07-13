'use client';

/* ══════════════════════════════════════════════════════════════════════════
 * /redefinir-senha: PR #102
 * --------------------------------------------------------------------------
 * Page client-side que recebe redirect do email de reset Supabase.
 *
 * Supabase envia link com tokens no HASH (implicit flow):
 *   /redefinir-senha#access_token=...&type=recovery
 *
 * Page detecta o hash, mostra form senha + confirmação, chama API que
 * usa Supabase Admin pra atualizar a senha do user. Redireciona /login.
 * ══════════════════════════════════════════════════════════════════════════ */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Loader2, Lock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Logo } from '../../../components/Logo';

export default function RedefinirSenhaPage() {
  const router = useRouter();
  const [tokenReady, setTokenReady] = useState(false);
  const [accessToken, setAccessToken] = useState<string>('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Detecta tokens no hash da URL (Supabase implicit flow recovery)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash;
    if (hash && hash.includes('access_token=')) {
      const params = new URLSearchParams(hash.replace(/^#/, ''));
      const at = params.get('access_token');
      const type = params.get('type');
      if (at && (type === 'recovery' || type === 'magiclink')) {
        setAccessToken(at);
        setTokenReady(true);
        // Limpa hash da URL
        window.history.replaceState({}, document.title, window.location.pathname);
      } else {
        setError('Link inválido ou expirado');
      }
    } else {
      setError('Link inválido. Abra direto pelo e-mail de redefinição');
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Senha deve ter pelo menos 8 caracteres');
      return;
    }
    if (password !== confirm) {
      setError('As senhas não coincidem');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: accessToken, password }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'Falha ao redefinir senha');
      setSuccess(true);
      setTimeout(() => router.push('/login'), 2500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao redefinir senha';
      setError(msg);
    } finally {
      setLoading(false);
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

        <div className="bg-white rounded-2xl shadow-lg p-8">
          {success ? (
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-50 mb-5">
                <CheckCircle2 size={28} className="text-green-600" />
              </div>
              <h2 className="text-xl font-semibold text-text-primary mb-2">Senha redefinida!</h2>
              <p className="text-sm text-text-secondary leading-relaxed mb-6">
                Sua nova senha está ativa. Redirecionando pro login em alguns segundos.
              </p>
              <Link
                href="/login"
                className="block w-full bg-primary-500 text-white py-2.5 rounded-lg font-medium hover:bg-primary-600 transition-colors"
              >
                Ir pro login agora
              </Link>
            </div>
          ) : !tokenReady && error ? (
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-50 mb-5">
                <AlertCircle size={28} className="text-red-600" />
              </div>
              <h2 className="text-xl font-semibold text-text-primary mb-2">Link inválido</h2>
              <p className="text-sm text-text-secondary leading-relaxed mb-6">{error}</p>
              <Link
                href="/recuperar-senha"
                className="block w-full bg-primary-500 text-white py-2.5 rounded-lg font-medium hover:bg-primary-600 transition-colors"
              >
                Solicitar novo link
              </Link>
            </div>
          ) : !tokenReady ? (
            <div className="text-center py-8">
              <Loader2 size={28} className="text-primary-500 animate-spin mx-auto mb-3" />
              <p className="text-sm text-text-secondary">Validando link...</p>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-semibold text-text-primary mb-2">Crie sua nova senha</h1>
              <p className="text-sm text-text-secondary mb-5 leading-relaxed">
                Mínimo 8 caracteres. Use uma senha forte que você não usa em outros lugares.
              </p>

              {error && (
                <div className="flex items-start gap-2 bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
                  <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-text-primary mb-1.5">Nova senha</label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-colors"
                    placeholder="••••••••"
                    autoFocus
                  />
                </div>
                <div>
                  <label htmlFor="confirm" className="block text-sm font-medium text-text-primary mb-1.5">Confirmar senha</label>
                  <input
                    id="confirm"
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    minLength={8}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-colors"
                    placeholder="••••••••"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-primary-500 text-white py-2.5 rounded-lg font-medium hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
                  {loading ? 'Salvando...' : 'Salvar nova senha'}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">ZappIQ © 2026 · uma plataforma MACHIA</p>
      </div>
    </div>
  );
}
