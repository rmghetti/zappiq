/**
 * Email Provider · Resend
 *
 * Wrapper idempotente para envio de e-mails via Resend API.
 * Em desenvolvimento ou sem RESEND_API_KEY, apenas loga o payload
 * e retorna um ID fake — não bloqueia a pilha.
 *
 * Trata 429 (rate limit) e 5xx com 2 retries + backoff exponencial.
 */

import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
  tags?: string[];
}

export interface SendEmailResult {
  id: string;
  delivered: 'resend' | 'log';
  to: string;
}

/**
 * Envia um e-mail via Resend API, ou loga em dev.
 *
 * @throws Erro se falhar após retries ou em configuração inválida
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  // Em dev ou sem API key, apenas loga
  if (env.NODE_ENV !== 'production' || !env.RESEND_API_KEY) {
    logger.info({
      msg: 'email_logged',
      to: input.to,
      subject: input.subject,
      tags: input.tags ?? [],
    });
    return {
      id: `log:${Date.now()}:${Math.random().toString(36).slice(2, 9)}`,
      delivered: 'log',
      to: input.to,
    };
  }

  // Retries com backoff exponencial: 2 retries máx
  const MAX_RETRIES = 2;
  let lastError: any;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: env.EMAIL_FROM,
          to: input.to,
          subject: input.subject,
          html: input.html,
          text: input.text,
          tags: input.tags ?? [],
          reply_to: env.EMAIL_REPLY_TO,
        }),
      });

      // Sucesso
      if (response.ok) {
        const data = (await response.json()) as { id: string };
        logger.info({
          msg: 'email_sent',
          to: input.to,
          subject: input.subject,
          resendId: data.id,
        });
        return {
          id: data.id,
          delivered: 'resend',
          to: input.to,
        };
      }

      // 429 (rate limit) ou 5xx → retry com backoff
      if (response.status === 429 || response.status >= 500) {
        const backoffMs = Math.pow(2, attempt) * 1000; // 1s, 2s, ...
        lastError = new Error(`HTTP ${response.status}`);

        if (attempt < MAX_RETRIES) {
          logger.warn({
            msg: 'email_retry',
            to: input.to,
            attempt: attempt + 1,
            statusCode: response.status,
            backoffMs,
          });
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
          continue;
        }
      }

      // Outro erro (4xx, etc) — não retenta
      const errorBody = await response.text();
      throw new Error(`Resend API error ${response.status}: ${errorBody}`);
    } catch (err) {
      lastError = err;
      // Se foi erro de rede e ainda há retries, tenta novamente
      if (attempt < MAX_RETRIES) {
        const backoffMs = Math.pow(2, attempt) * 1000;
        logger.warn({
          msg: 'email_retry',
          to: input.to,
          attempt: attempt + 1,
          error: String(err),
          backoffMs,
        });
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        continue;
      }
    }
  }

  // Esgotou retries
  logger.error({
    msg: 'email_failed',
    to: input.to,
    subject: input.subject,
    error: String(lastError),
  });
  throw lastError;
}
