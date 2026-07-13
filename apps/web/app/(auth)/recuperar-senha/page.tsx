'use client';

/* ══════════════════════════════════════════════════════════════════════════
 * /recuperar-senha: PR #102
 * --------------------------------------------------------------------------
 * Form simples: cliente digita email → backend envia link de reset →
 * cliente abre email → cai em /redefinir-senha pra criar nova senha.
 *
 * Funciona tanto pra "esqueci minha senha" quanto pra cliente que entrou
 * via Magic Link/Google e quer DEFINIR senha pela primeira vez.
 *
 * Resposta sempre genérica (200) pra evitar enumeração de usuários.
 * ══════════════════════════════════════════════════════════════════════════ */

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Loader2, Mail, AlertCircle, ArrowLeft } from 'lucide-react';
import { Logo } from '../../../components/Logo';

export default function RecuperarSenhaPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      setError('Digite seu e-mail');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'Falha ao enviar link');
      setSent(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao enviar link';
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
          {!sent ? (
            <>
              <h1 className="text-xl font-semibold text-text-primary mb-2">Recuperar ou definir senha</h1>
              <p className="text-sm text-text-secondary mb-5 leading-relaxed">
                Digite o e-mail da sua conta. Enviaremos um link pra você criar ou redefinir sua senha.
              </p>

              {error && (
                <div className="flex items-start gap-2 bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
                  <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
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
                    autoFocus
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-primary-500 text-white py-2.5 rounded-lg font-medium hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
                  {loading ? 'Enviando...' : 'Enviar link de redefinição'}
                </button>
              </form>
            </>
          ) : (
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-50 mb-5">
                <Mail size={28} className="text-primary-500" />
              </div>
              <h2 className="text-xl font-semibold text-text-primary mb-2">
                Pronto. Confira seu <span className="text-primary-500">e-mail</span>.
              </h2>
              <p className="text-sm text-text-secondary leading-relaxed mb-6">
                Se este e-mail estiver cadastrado, enviamos um link pra criar/redefinir sua senha.
                O link expira em 30 minutos.
              </p>
              <div className="bg-gray-50 rounded-xl p-4 text-left mb-6">
                <p className="text-xs font-semibold text-text-primary mb-2">Não chegou?</p>
                <ul className="text-xs text-text-secondary space-y-1">
                  <li>• Verifique spam/lixo eletrônico</li>
                  <li>• Confirme que o e-mail está correto</li>
                  <li>• Aguarde até 1 minuto (envio assíncrono)</li>
                </ul>
              </div>
            </div>
          )}

          <Link
            href="/login"
            className="mt-6 flex items-center justify-center gap-1.5 text-sm text-text-secondary hover:text-primary-500 transition-colors"
          >
            <ArrowLeft size={14} /> Voltar ao login
          </Link>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">ZappIQ © 2026 · uma plataforma MACHIA</p>
      </div>
    </div>
  );
}
