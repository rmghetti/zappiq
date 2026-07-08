/*
 * Impulso — saneamento de canais e resolução da copy de disparo.
 *
 * sanitizeChannels aplica o gate de negócio server-side: o canal "instagram"
 * só entra numa campanha se a org tiver o Instagram conectado (hasInstagram =
 * organization.instagramAccountId presente). O front não consegue burlar isso.
 * Impulso é WhatsApp-cêntrico: se sobrar nenhum canal válido, cai pra whatsapp.
 *
 * resolveCampaignMessage escolhe o texto que vai de fato ser disparado por
 * canal — a mensagem salva/editada pelo cliente vence; sem ela, cai no
 * bodyText do template legado; sem nada, string vazia (não quebra o disparo).
 */

export const IMPULSO_CHANNELS = ['whatsapp', 'email', 'sms', 'instagram'] as const;
export type ImpulsoChannel = (typeof IMPULSO_CHANNELS)[number];

export function sanitizeChannels(input: unknown, opts: { hasInstagram: boolean }): string[] {
  const arr = Array.isArray(input) ? input : [];
  const cleaned = arr
    .filter((c): c is string => typeof c === 'string')
    .map((c) => c.toLowerCase().trim())
    .filter((c): c is ImpulsoChannel => (IMPULSO_CHANNELS as readonly string[]).includes(c));

  let channels = Array.from(new Set<string>(cleaned));
  if (!opts.hasInstagram) channels = channels.filter((c) => c !== 'instagram');
  if (channels.length === 0) channels = ['whatsapp'];
  return channels;
}

export function resolveCampaignMessage(
  campaign: { message?: unknown; template?: { bodyText?: string | null } | null },
  channel: string,
): string {
  const msg = campaign.message;
  if (msg && typeof msg === 'object' && !Array.isArray(msg)) {
    const v = (msg as Record<string, unknown>)[channel];
    if (typeof v === 'string' && v.trim().length > 0) return v;
  }
  return campaign.template?.bodyText ?? '';
}
