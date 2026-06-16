/**
 * Maestro v3 (Spec 1A) — interpolação {{var}} em conteúdo de fluxo. PURO.
 * Sintaxe: {{ caminho.com.pontos }} com fallback opcional {{ x | "default" }}.
 * Nunca lança: token ausente → fallback ou vazio; malformado → deixa intacto.
 */
export interface RenderScope {
  vars?: Record<string, any>;
  contact?: Record<string, any>;
  system?: Record<string, any>;
}

const TOKEN = /\{\{\s*([a-zA-Z0-9_$.]+)\s*(?:\|\s*"([^"]*)"\s*)?\}\}/g;

function resolvePath(scope: RenderScope, path: string): any {
  const parts = path.split('.');
  let cur: any = scope;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[p];
  }
  return cur;
}

function stringify(value: any): string {
  if (value == null) return '';
  if (typeof value === 'object') {
    try { return JSON.stringify(value).slice(0, 200); } catch { return ''; }
  }
  return String(value);
}

export function renderTemplate(text: string, scope: RenderScope): string {
  if (!text) return text ?? '';
  return text.replace(TOKEN, (_m, path: string, fallback?: string) => {
    const v = resolvePath(scope, path);
    if (v === undefined || v === null) return fallback ?? '';
    return stringify(v);
  });
}
