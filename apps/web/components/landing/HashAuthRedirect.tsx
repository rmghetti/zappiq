'use client';

/**
 * HashAuthRedirect — Detecta tokens de auth Supabase no hash da URL
 * (implicit flow Confirm Signup, Magic Link, Password Recovery) e
 * redireciona pra /cadastro?verified=1 mantendo o hash.
 *
 * NECESSIDADE TÉCNICA: Supabase Confirm Signup template IGNORA
 * `emailRedirectTo` passado em signInWithOtp e sempre redireciona pra
 * Site URL (raiz https://zappiq.com.br/). Esse handler é montado no
 * layout root pra interceptar em qualquer página.
 *
 * Comportamento:
 * - Detecta `#access_token=...&type=signup|magiclink|recovery`
 * - Se já está em /cadastro, NÃO redireciona (deixa Cadastro.tsx processar)
 * - Senão, redireciona pra /cadastro?verified=1#hash (preserva tokens)
 */

import { useEffect } from 'react';

export function HashAuthRedirect() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const hash = window.location.hash;
    if (!hash || !hash.includes('access_token=')) return;

    const params = new URLSearchParams(hash.replace(/^#/, ''));
    const type = params.get('type');

    // Só processa fluxos de auth conhecidos
    if (!type || !['signup', 'magiclink', 'recovery'].includes(type)) return;

    // Se já está em /cadastro, deixa o componente local processar
    if (window.location.pathname.startsWith('/cadastro')) return;

    // Senão, redireciona pra /cadastro mantendo hash (tokens)
    window.location.replace(`/cadastro?verified=1${hash}`);
  }, []);

  return null;
}
