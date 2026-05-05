/**
 * Analytics client helper — usado em components 'use client'.
 *
 * track('event_name', { prop1: 'value' })
 *   → POST /api/analytics fire-and-forget
 *   → server insere em analytics_events table no Supabase
 *
 * Session ID gerado UMA VEZ por sessionStorage (zera ao fechar tab).
 * Não usa cookies — privacy-first, dispensa banner de consent extra
 * (já temos CookieBanner no layout).
 */

const SESSION_STORAGE_KEY = 'zq_session_id';

function getOrCreateSessionId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const existing = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (existing) return existing;
    const newId = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : `s_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, newId);
    return newId;
  } catch {
    return null;
  }
}

export function track(
  eventName: string,
  props: Record<string, unknown> = {},
  options: { userEmail?: string } = {}
): void {
  if (typeof window === 'undefined') return;

  const sessionId = getOrCreateSessionId();
  const pageUrl = window.location.pathname + window.location.search;

  // Fire-and-forget. Não usa await — não bloqueia UX.
  fetch('/api/analytics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event_name: eventName,
      props,
      session_id: sessionId,
      user_email: options.userEmail,
      page_url: pageUrl,
    }),
    keepalive: true, // sobrevive a navegações
  }).catch((err) => {
    // Silent fail — analytics nunca quebra UX
    console.debug('[analytics] track failed:', err);
  });
}
