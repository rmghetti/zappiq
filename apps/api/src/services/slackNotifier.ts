/**
 * Slack Notifier — webhook helper minimalista pra alertas operacionais.
 *
 * Uso:
 *   await sendSlackAlert({ webhook: env.SLACK_WEBHOOK_QUOTA_ALERTS, text: '...', blocks: [...] });
 *
 * Comportamento:
 *   - Se o webhook URL não estiver configurado (env vazio), retorna silenciosamente.
 *     Isso permite que dev local não exploda quando não tem Slack workspace.
 *   - Em prod, falhas de rede são logadas como WARN (não-bloqueantes) — alertas
 *     não devem derrubar pipelines críticos.
 *   - Timeout de 5s — Slack normalmente responde em <500ms; se passar disso,
 *     tem algo errado e não vale a pena travar o cron.
 *
 * Helpers de bloco prontos: buildHeaderBlock, buildSectionBlock, buildFieldsBlock.
 * Para mensagens mais sofisticadas, importe direto Block Kit JSON.
 */

import { logger } from '../utils/logger.js';

type SlackBlock = Record<string, unknown>;

export interface SlackAlertInput {
  webhook: string | undefined;
  text: string; // fallback text (notification preview + no-blocks fallback)
  blocks?: SlackBlock[];
  channel?: string; // opcional, força canal específico no webhook (alguns webhooks aceitam)
  username?: string;
  iconEmoji?: string;
}

export async function sendSlackAlert(input: SlackAlertInput): Promise<boolean> {
  const { webhook, text, blocks, channel, username, iconEmoji } = input;

  if (!webhook || webhook.trim() === '') {
    logger.debug('[Slack] Webhook não configurado — pulando alerta');
    return false;
  }

  const payload: Record<string, unknown> = { text };
  if (blocks && blocks.length) payload.blocks = blocks;
  if (channel) payload.channel = channel;
  if (username) payload.username = username;
  if (iconEmoji) payload.icon_emoji = iconEmoji;

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), 5_000);

  try {
    const res = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      logger.warn(`[Slack] Alerta retornou ${res.status}: ${body.slice(0, 200)}`);
      return false;
    }
    return true;
  } catch (err: any) {
    logger.warn(`[Slack] Falha ao enviar alerta: ${err.message}`);
    return false;
  } finally {
    clearTimeout(timeoutHandle);
  }
}

// ─── Block Kit helpers ──────────────────────────────────────

export function buildHeaderBlock(text: string): SlackBlock {
  return {
    type: 'header',
    text: { type: 'plain_text', text: text.slice(0, 150), emoji: true },
  };
}

export function buildSectionBlock(markdown: string): SlackBlock {
  return {
    type: 'section',
    text: { type: 'mrkdwn', text: markdown.slice(0, 3000) },
  };
}

export function buildFieldsBlock(fields: Array<{ label: string; value: string }>): SlackBlock {
  // Slack suporta no máximo 10 fields por bloco; truncamos.
  const truncated = fields.slice(0, 10);
  return {
    type: 'section',
    fields: truncated.map((f) => ({
      type: 'mrkdwn',
      text: `*${f.label}*\n${f.value}`.slice(0, 2000),
    })),
  };
}

export function buildContextBlock(text: string): SlackBlock {
  return {
    type: 'context',
    elements: [{ type: 'mrkdwn', text: text.slice(0, 750) }],
  };
}

export function buildDividerBlock(): SlackBlock {
  return { type: 'divider' };
}
