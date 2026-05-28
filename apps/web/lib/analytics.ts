/**
 * Analytics client helper — usado em components 'use client'.
 *
 * track('event_name', { prop1: 'value' })
 *   → POST /api/analytics fire-and-forget
 *   → server insere em analytics_events table no Supabase
 *
 * UTM attribution (first-touch):
 *   - Captura utm_source/medium/campaign/content/term da URL na primeira visita
 *   - Armazena em sessionStorage (zera ao fechar tab — mas funciona pra session)
 *   - Persiste em localStorage também como fallback (sobrevive a fechar tab)
 *   - getUtm() retorna sempre o first-touch (não sobrescreve ao trocar URL)
 *
 * Privacy: sessionStorage/localStorage só. Nunca cookies extras.
 *
 * PR #94: UTM attribution capturada e enviada com cada track().
 */

const SESSION_STORAGE_KEY = 'zq_session_id';
const UTM_STORAGE_KEY = 'zq_utm_first_touch';

interface UtmData {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
}

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

/**
 * UTM first-touch:
 * - Se há UTM na URL atual E ainda não temos UTM salvo → salva (first-touch)
 * - Se já temos UTM salvo → mantém (não sobrescreve)
 * - Retorna sempre o salvo (ou os atuais da URL como fallback)
 */
export function getUtm(): UtmData {
  if (typeof window === 'undefined') return {};

  // 1. Tenta carregar first-touch persistido (localStorage)
  let stored: UtmData = {};
  try {
    const raw = window.localStorage.getItem(UTM_STORAGE_KEY);
    if (raw) stored = JSON.parse(raw);
  } catch {
    // Storage pode estar bloqueado em modo privado
  }

  // 2. Lê UTM da URL atual
  let fromUrl: UtmData = {};
  try {
    const params = new URLSearchParams(window.location.search);
    const keys: (keyof UtmData)[] = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
    keys.forEach(k => {
      const v = params.get(k);
      if (v) fromUrl[k] = v.slice(0, 100); // sanitize length
    });
  } catch {
    // URLSearchParams pode falhar em URLs malformadas
  }

  // 3. Detecta source orgânico via referrer (se não há UTM)
  if (!fromUrl.utm_source && !stored.utm_source && document.referrer) {
    try {
      const refHost = new URL(document.referrer).hostname.replace('www.', '');
      const currHost = window.location.hostname.replace('www.', '');
      if (refHost && refHost !== currHost) {
        // Heurística simples — pode ser refinado depois
        if (refHost.includes('google')) fromUrl.utm_source = 'google_organic';
        else if (refHost.includes('linkedin')) fromUrl.utm_source = 'linkedin_organic';
        else if (refHost.includes('instagram')) fromUrl.utm_source = 'instagram_organic';
        else if (refHost.includes('facebook')) fromUrl.utm_source = 'facebook_organic';
        else if (refHost.includes('twitter') || refHost.includes('x.com')) fromUrl.utm_source = 'twitter_organic';
        else fromUrl.utm_source = `referral:${refHost}`;
        fromUrl.utm_medium = 'referral';
      }
    } catch {
      // referrer pode estar vazio
    }
  }

  // 4. Se temos UTM da URL E ainda não havia stored → persiste (first-touch)
  if (Object.keys(fromUrl).length > 0 && Object.keys(stored).length === 0) {
    try {
      window.localStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(fromUrl));
      stored = fromUrl;
    } catch {
      // Falha localStorage não bloqueia
      stored = fromUrl;
    }
  }

  return Object.keys(stored).length > 0 ? stored : fromUrl;
}

export function track(
  eventName: string,
  props: Record<string, unknown> = {},
  options: { userEmail?: string } = {}
): void {
  if (typeof window === 'undefined') return;

  const sessionId = getOrCreateSessionId();
  const pageUrl = window.location.pathname + window.location.search;
  const utm = getUtm();

  fetch('/api/analytics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event_name: eventName,
      props,
      session_id: sessionId,
      user_email: options.userEmail,
      page_url: pageUrl,
      ...utm,
    }),
    keepalive: true,
  }).catch((err) => {
    console.debug('[analytics] track failed:', err);
  });
}
