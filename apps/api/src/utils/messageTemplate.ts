/* ══════════════════════════════════════════════════════════════════════
 * FEATURE 5b.2 · messageTemplate.ts
 * --------------------------------------------------------------------
 * Lógica pura de templates de WhatsApp (Meta Cloud API). Sem I/O — só
 * regras de negócio testáveis:
 *   - categorias válidas da Meta (MARKETING / UTILITY / AUTHENTICATION)
 *   - normalização de categoria (case-insensitive, default seguro)
 *   - elegibilidade de um template pra REABRIR a janela de 24h
 *     (fora da janela a Meta rejeita free-form; só template aprovado passa)
 *   - decisão "dá pra mandar free-form ou precisa de template?" a partir
 *     do timestamp da última mensagem inbound do contato.
 * ══════════════════════════════════════════════════════════════════════ */

/** Categorias oficiais de template da Meta Cloud API. */
export const META_TEMPLATE_CATEGORIES = ['MARKETING', 'UTILITY', 'AUTHENTICATION'] as const;
export type MetaTemplateCategory = (typeof META_TEMPLATE_CATEGORIES)[number];

/** Janela de atendimento (customer service window) da Meta: 24 horas. */
export const META_24H_WINDOW_MS = 24 * 60 * 60 * 1000;

export function isValidCategory(value: unknown): value is MetaTemplateCategory {
  return typeof value === 'string' && (META_TEMPLATE_CATEGORIES as readonly string[]).includes(value.toUpperCase());
}

/**
 * Normaliza uma categoria arbitrária pra uma categoria válida da Meta.
 * Case-insensitive. Valor desconhecido/ausente → 'MARKETING' (default seguro
 * pro fluxo de campanha, que é o uso mais comum aqui).
 */
export function normalizeCategory(value: unknown): MetaTemplateCategory {
  if (typeof value === 'string') {
    const upper = value.toUpperCase();
    if ((META_TEMPLATE_CATEGORIES as readonly string[]).includes(upper)) {
      return upper as MetaTemplateCategory;
    }
  }
  return 'MARKETING';
}

export interface TemplateLike {
  metaStatus?: string | null;
  isReengagement?: boolean | null;
}

/** Um template está aprovado na Meta? (case-insensitive, tolera null) */
export function isApproved(t: TemplateLike): boolean {
  return String(t.metaStatus ?? '').toUpperCase() === 'APPROVED';
}

/**
 * Template pode ser usado pra REABRIR a janela de 24h?
 * Precisa estar marcado como reengajamento E aprovado pela Meta — caso
 * contrário a Meta rejeita o envio fora da janela.
 */
export function canReopenWindow(t: TemplateLike): boolean {
  return Boolean(t.isReengagement) && isApproved(t);
}

/**
 * O contato ainda está dentro da janela de 24h?
 * @param lastInboundAt  timestamp da última mensagem RECEBIDA do contato (ms epoch, Date, ou null)
 * @param now            referência de "agora" (ms epoch), default Date.now()
 */
export function isWithin24hWindow(
  lastInboundAt: number | Date | null | undefined,
  now: number = Date.now(),
): boolean {
  if (lastInboundAt == null) return false;
  const last = lastInboundAt instanceof Date ? lastInboundAt.getTime() : lastInboundAt;
  if (!Number.isFinite(last)) return false;
  return now - last < META_24H_WINDOW_MS;
}

/**
 * Decide o que é possível enviar agora pra um contato.
 *   - dentro da janela → pode free-form (template opcional)
 *   - fora da janela  → SÓ template (a Meta rejeita free-form)
 */
export function outboundSendMode(
  lastInboundAt: number | Date | null | undefined,
  now: number = Date.now(),
): 'freeform_or_template' | 'template_required' {
  return isWithin24hWindow(lastInboundAt, now) ? 'freeform_or_template' : 'template_required';
}
