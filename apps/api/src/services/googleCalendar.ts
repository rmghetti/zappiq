/**
 * Google Calendar — conector OAuth por organização.
 *
 * Modelo: UM app ZappIQ (GOOGLE_OAUTH_CLIENT_ID/SECRET), MUITOS clientes, cada
 * um autoriza a PRÓPRIA conta. O refresh token de cada cliente fica em
 * CalendarConnection (cifrado). Aqui: URL de consentimento, troca de código,
 * refresh de access token, free/busy e CRUD mínimo de evento.
 *
 * Escopos: calendar.events (criar/editar) + calendar.freebusy (disponibilidade).
 */
import { prisma } from '@zappiq/database';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { encryptSecret, decryptSecret } from '../utils/crypto.js';

const AUTH_BASE = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.freebusy',
  'openid',
  'email',
];

export function isGoogleConfigured(): boolean {
  return Boolean(env.GOOGLE_OAUTH_CLIENT_ID && env.GOOGLE_OAUTH_CLIENT_SECRET);
}

/**
 * URL de consentimento. `state` carrega o orgId assinado pelo caller (aqui só
 * repassamos). access_type=offline + prompt=consent garante refresh_token.
 */
export function buildAuthUrl(state: string): string {
  const p = new URLSearchParams({
    client_id: env.GOOGLE_OAUTH_CLIENT_ID || '',
    redirect_uri: env.GOOGLE_OAUTH_REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  });
  return `${AUTH_BASE}?${p.toString()}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
  id_token?: string;
}

export async function exchangeCode(code: string): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_OAUTH_CLIENT_ID || '',
      client_secret: env.GOOGLE_OAUTH_CLIENT_SECRET || '',
      redirect_uri: env.GOOGLE_OAUTH_REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) throw new Error(`google_token_exchange_${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json() as Promise<TokenResponse>;
}

async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number }> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: env.GOOGLE_OAUTH_CLIENT_ID || '',
      client_secret: env.GOOGLE_OAUTH_CLIENT_SECRET || '',
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) throw new Error(`google_token_refresh_${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json() as Promise<{ access_token: string; expires_in: number }>;
}

/** Decodifica o e-mail do id_token (JWT) sem verificar assinatura (só display). */
export function emailFromIdToken(idToken?: string): string | null {
  if (!idToken) return null;
  try {
    const payload = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64').toString('utf8'));
    return payload.email || null;
  } catch {
    return null;
  }
}

/**
 * Salva/atualiza a conexão da org (tokens cifrados). Chamado no callback OAuth.
 * Se o Google não devolver refresh_token (reautorização), preserva o anterior.
 */
export async function saveConnection(orgId: string, tokens: TokenResponse): Promise<void> {
  const email = emailFromIdToken(tokens.id_token);
  const existing = await (prisma as any).calendarConnection.findFirst({ where: { organizationId: orgId, provider: 'google' } });
  const refreshEnc = tokens.refresh_token
    ? encryptSecret(tokens.refresh_token)
    : existing?.refreshTokenEnc || null;
  const data = {
    provider: 'google' as const,
    status: 'active' as const,
    externalAccountEmail: email,
    accessTokenEnc: encryptSecret(tokens.access_token),
    refreshTokenEnc: refreshEnc,
    tokenExpiresAt: new Date(Date.now() + (tokens.expires_in - 60) * 1000),
    scope: tokens.scope,
    targetCalendarId: 'primary',
  };
  if (existing) {
    await (prisma as any).calendarConnection.update({ where: { id: existing.id }, data });
  } else {
    await (prisma as any).calendarConnection.create({ data: { organizationId: orgId, ...data } });
  }
}

/** Access token válido da org (refresh sob demanda). null se não conectado. */
async function getAccessToken(orgId: string): Promise<string | null> {
  const conn = await (prisma as any).calendarConnection.findFirst({ where: { organizationId: orgId, provider: 'google', status: 'active' } });
  if (!conn?.refreshTokenEnc) return null;
  // Access token ainda válido?
  if (conn.accessTokenEnc && conn.tokenExpiresAt && new Date(conn.tokenExpiresAt) > new Date()) {
    try { return decryptSecret(conn.accessTokenEnc); } catch { /* cai no refresh */ }
  }
  try {
    const refresh = decryptSecret(conn.refreshTokenEnc);
    const fresh = await refreshAccessToken(refresh);
    await (prisma as any).calendarConnection.update({
      where: { id: conn.id },
      data: { accessTokenEnc: encryptSecret(fresh.access_token), tokenExpiresAt: new Date(Date.now() + (fresh.expires_in - 60) * 1000) },
    });
    return fresh.access_token;
  } catch (err: any) {
    // refresh falhou → provável revogação. Marca a conexão como expirada.
    logger.warn(`[googleCalendar] refresh falhou org=${orgId}: ${err.message}`);
    await (prisma as any).calendarConnection.update({ where: { id: conn.id }, data: { status: 'expired' } }).catch(() => {});
    return null;
  }
}

export async function hasActiveConnection(orgId: string): Promise<boolean> {
  const conn = await (prisma as any).calendarConnection.findFirst({ where: { organizationId: orgId, provider: 'google', status: 'active' } });
  return Boolean(conn);
}

/** Intervalos ocupados na agenda Google da org, entre from/to. [] se não conectado. */
export async function getBusy(orgId: string, fromMs: number, toMs: number): Promise<{ startMs: number; endMs: number }[]> {
  const token = await getAccessToken(orgId);
  if (!token) return [];
  try {
    const res = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ timeMin: new Date(fromMs).toISOString(), timeMax: new Date(toMs).toISOString(), items: [{ id: 'primary' }] }),
    });
    if (!res.ok) { logger.warn(`[googleCalendar] freeBusy ${res.status} org=${orgId}`); return []; }
    const data: any = await res.json();
    const busy = data?.calendars?.primary?.busy || [];
    return busy.map((b: any) => ({ startMs: Date.parse(b.start), endMs: Date.parse(b.end) }));
  } catch (err: any) {
    logger.warn(`[googleCalendar] getBusy erro org=${orgId}: ${err.message}`);
    return [];
  }
}

/** Cria evento na agenda da org. Devolve o eventId (ou null se não conectado/erro). */
export async function insertEvent(orgId: string, ev: {
  summary: string; description?: string; startIso: string; endIso: string; timezone: string;
  attendeeEmail?: string | null; location?: string | null;
}): Promise<string | null> {
  const token = await getAccessToken(orgId);
  if (!token) return null;
  try {
    const body: any = {
      summary: ev.summary,
      description: ev.description,
      location: ev.location || undefined,
      start: { dateTime: ev.startIso, timeZone: ev.timezone },
      end: { dateTime: ev.endIso, timeZone: ev.timezone },
    };
    if (ev.attendeeEmail) body.attendees = [{ email: ev.attendeeEmail }];
    const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    if (!res.ok) { logger.warn(`[googleCalendar] insertEvent ${res.status} org=${orgId}`); return null; }
    const data: any = await res.json();
    return data?.id || null;
  } catch (err: any) {
    logger.warn(`[googleCalendar] insertEvent erro org=${orgId}: ${err.message}`);
    return null;
  }
}

export async function deleteEvent(orgId: string, eventId: string): Promise<void> {
  const token = await getAccessToken(orgId);
  if (!token) return;
  await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`, {
    method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
  }).catch(() => {});
}

export async function disconnect(orgId: string): Promise<void> {
  await (prisma as any).calendarConnection.updateMany({ where: { organizationId: orgId, provider: 'google' }, data: { status: 'revoked', accessTokenEnc: null, refreshTokenEnc: null } });
}
