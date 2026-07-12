'use client';

/**
 * HashAuthRedirect: Detecta tokens de auth Supabase no hash da URL
 * (implicit flow Confirm Signup, Magic Link, Password Recovery, OAuth) e
 * redireciona pra /cadastro?verified=1 mantendo o hash.
 *
 * NECESSIDADE TÉCNICA: Supabase Site URL hardcoded sobrescreve qualquer
 * redirectTo customizado. Magic Link / Confirm Signup / OAuth caem todos
 * em https://zappiq.com.br/#access_token=... Esse handler é montado no
 * layout root pra interceptar em qualquer página.
 *
 * Comportamento (PR #91 atualizado):
 * - Detecta `#access_token=...&type=signup|magiclink|recovery` (Magic Link path)
 * - Detecta `#access_token=...&provider_token=...` (OAuth path, Google etc)
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
    const providerToken = params.get('provider_token');

    // Aceita 3 cenários auth conhecidos:
    //  1. type=signup|magiclink|recovery (Confirm Signup, Magic Link, Recovery)
    //  2. provider_token presente (OAuth implicit flow, Google etc)
    const isKnownAuthFlow =
      (type !== null && ['signup', 'magiclink', 'recovery'].includes(type)) ||
      providerToken !== null;
    if (!isKnownAuthFlow) return;

    // Se já está em /cadastro, deixa o componente local processar
    if (window.location.pathname.startsWith('/cadastro')) return;

    // Senão, redireciona pra /cadastro mantendo hash (tokens)
    window.location.replace(`/cadastro?verified=1${hash}`);
  }, []);

  return null;
}
