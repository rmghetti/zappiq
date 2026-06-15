/**
 * AG2 · Webhook Tool (Pacote 2.6 — Maestro AI agêntico)
 *
 * buildWebhookToolDef  — PURE: converte cfg de nó webhook em ToolDefinition para o LLM.
 * executeWebhook       — IO: chama o endpoint do cliente com SSRF guard, timeout e size cap.
 *
 * NOTE: assertPublicUrl copiado de ragService.ts (não exportado lá).
 * Se ragService.ts exportar no futuro, substituir a cópia por import.
 */

import type { ToolDefinition } from '../services/llm/LLMRouter.js';

// ---------------------------------------------------------------------------
// SSRF guard — copiado de apps/api/src/services/ragService.ts (função privada)
// Lança Error em URLs internas/privadas/metadata.
// ---------------------------------------------------------------------------
function assertPublicUrl(url: string): void {
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw new Error('Invalid URL'); }

  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Only http/https URLs allowed');

  const hostname = parsed.hostname.toLowerCase();
  const blocked = [
    'localhost', '127.0.0.1', '0.0.0.0', '[::1]',
    '169.254.169.254',   // cloud metadata
    'metadata.google.internal',
  ];
  if (blocked.includes(hostname)) throw new Error('Internal URLs are not allowed');

  // Block RFC 1918 private ranges
  const parts = hostname.split('.').map(Number);
  if (parts.length === 4 && parts.every(p => !isNaN(p))) {
    if (parts[0] === 10) throw new Error('Private IP not allowed');
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) throw new Error('Private IP not allowed');
    if (parts[0] === 192 && parts[1] === 168) throw new Error('Private IP not allowed');
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WebhookToolConfig {
  type: 'webhook';
  name: string;
  description: string;
  url: string;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  paramsSchema?: any; // JSON schema do input
}

export interface WebhookResult {
  ok: boolean;
  status?: number;
  body?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TIMEOUT_MS = 8_000;
const MAX_BYTES = 32 * 1024; // 32 KB

// ---------------------------------------------------------------------------
// buildWebhookToolDef — PURE
// ---------------------------------------------------------------------------

export function buildWebhookToolDef(cfg: WebhookToolConfig): ToolDefinition {
  // Anthropic exige name em [a-z0-9_], máx 64 chars
  const name = String(cfg.name || 'webhook')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .slice(0, 60) || 'webhook';

  const description = String(
    cfg.description || 'Chama um endpoint externo do negócio.'
  ).slice(0, 500);

  const inputSchema: Record<string, unknown> =
    cfg.paramsSchema && typeof cfg.paramsSchema === 'object'
      ? cfg.paramsSchema
      : { type: 'object', properties: {}, additionalProperties: true };

  return { name, description, inputSchema };
}

// ---------------------------------------------------------------------------
// executeWebhook — IO (fail-soft: nunca lança)
// ---------------------------------------------------------------------------

export async function executeWebhook(
  cfg: WebhookToolConfig,
  input: Record<string, any>
): Promise<WebhookResult> {
  const method = cfg.method === 'GET' ? 'GET' : 'POST';

  try {
    let url = cfg.url;

    // GET: serializa input como query string
    if (method === 'GET' && input && Object.keys(input).length) {
      const u = new URL(cfg.url);
      for (const [k, v] of Object.entries(input)) {
        u.searchParams.set(k, typeof v === 'string' ? v : JSON.stringify(v));
      }
      url = u.toString();
    }

    // SSRF guard — deve rodar ANTES do fetch
    assertPublicUrl(url);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const resp = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(cfg.headers ?? {}),
        },
        body: method === 'POST' ? JSON.stringify(input ?? {}) : undefined,
        signal: controller.signal,
      });

      const text = (await resp.text()).slice(0, MAX_BYTES);
      return { ok: resp.ok, status: resp.status, body: text };
    } finally {
      clearTimeout(timer);
    }
  } catch (e: any) {
    // fail-soft: nunca propaga — retorna erro estruturado
    return { ok: false, error: String(e?.message ?? e).slice(0, 300) };
  }
}
