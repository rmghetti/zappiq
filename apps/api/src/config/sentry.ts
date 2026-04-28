import { logger } from '../utils/logger.js';
import { redactPII, redactDeep } from '../utils/piiRedactor.js';

/**
 * V2-022 (Sprint 0 Blocker 3): beforeSend hook que redaciona PII BR
 * de todo payload antes de enviar pro Sentry. Cobre message, exception
 * value, request URL/headers e user.id.
 *
 * Sentry SaaS não está em GRU1 (US), então qualquer PII vazada aqui é
 * transferência internacional de dado pessoal sem base legal — fix
 * obrigatório pré-launch.
 */
function redactSentryPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const r = redactDeep(payload);
  return r.redacted as Record<string, unknown>;
}

interface SentryContext {
  req?: { method?: string; url?: string; headers?: Record<string, string> };
  userId?: string;
  [key: string]: unknown;
}

interface SentryPayload {
  dsn: string;
  message?: string;
  exception?: Array<{ type: string; value: string; stacktrace?: { frames: unknown[] } }>;
  level: string;
  environment: string;
  release?: string;
  tags: { runtime: string; [key: string]: string };
  request?: { method?: string; url?: string; headers?: Record<string, string> };
  user?: { id: string };
  timestamp: number;
}

let sentryDsn: string | null = null;
let projectId: string | null = null;
let dsnOrigin: string | null = null;
let gitSha: string | null = null;
let environment: string | null = null;

export function initSentry(dsnInput?: string, gitShaInput?: string): void {
  sentryDsn = dsnInput || process.env.SENTRY_DSN || null;
  gitSha = gitShaInput || process.env.GIT_SHA || null;
  environment = process.env.NODE_ENV || 'development';

  if (sentryDsn) {
    try {
      const url = new URL(sentryDsn);
      dsnOrigin = `${url.protocol}//${url.host}`;
      const pathParts = url.pathname.split('/');
      projectId = pathParts[pathParts.length - 1];
      logger.info(`[Sentry] Initialized with project ${projectId} in ${environment}`);
    } catch (err) {
      logger.error(`[Sentry] Invalid DSN format: ${sentryDsn}`, { error: err });
      sentryDsn = null;
    }
  }
}

export async function captureException(
  error: Error | unknown,
  context?: SentryContext
): Promise<void> {
  const err = error instanceof Error ? error : new Error(String(error));
  const level = 'error';

  logger.error(`[Exception] ${err.message}`, {
    stack: err.stack,
    context,
  });

  if (!sentryDsn || !dsnOrigin || !projectId || environment !== 'production') {
    return;
  }

  try {
    const payload: SentryPayload = {
      dsn: sentryDsn,
      exception: [
        {
          type: err.name || 'Error',
          value: err.message,
          stacktrace: {
            frames: parseStackTrace(err.stack),
          },
        },
      ],
      level,
      environment,
      release: gitSha || undefined,
      tags: {
        runtime: 'node',
      },
      timestamp: Math.floor(Date.now() / 1000),
    };

    if (context?.req) {
      payload.request = {
        method: context.req.method,
        url: context.req.url,
        headers: context.req.headers,
      };
    }

    if (context?.userId) {
      payload.user = { id: context.userId };
    }

    const storeUrl = `${dsnOrigin}/api/${projectId}/store/`;
    // V2-022: redaciona PII BR antes de enviar pro Sentry (US-hosted)
    const redactedPayload = redactSentryPayload(payload as unknown as Record<string, unknown>);
    await fetch(storeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(redactedPayload),
    });
  } catch (sendErr) {
    logger.warn(`[Sentry] Failed to send exception`, { error: sendErr });
  }
}

export async function captureMessage(
  message: string,
  level: 'info' | 'warning' | 'error' = 'info',
  context?: SentryContext
): Promise<void> {
  logger.info(`[Message] ${message}`, { level, context });

  if (!sentryDsn || !dsnOrigin || !projectId || environment !== 'production') {
    return;
  }

  try {
    const payload: SentryPayload = {
      dsn: sentryDsn,
      message,
      level,
      environment,
      release: gitSha || undefined,
      tags: {
        runtime: 'node',
      },
      timestamp: Math.floor(Date.now() / 1000),
    };

    if (context?.userId) {
      payload.user = { id: context.userId };
    }

    const storeUrl = `${dsnOrigin}/api/${projectId}/store/`;
    // V2-022: redaciona PII BR antes de enviar pro Sentry (US-hosted)
    const redactedPayload = redactSentryPayload(payload as unknown as Record<string, unknown>);
    await fetch(storeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(redactedPayload),
    });
  } catch (sendErr) {
    logger.warn(`[Sentry] Failed to send message`, { error: sendErr });
  }
}

function parseStackTrace(stack?: string): unknown[] {
  const frames: unknown[] = [];
  if (!stack) return frames;

  const lines = stack.split('\n').slice(1);
  for (const line of lines) {
    const match = line.match(/at\s+(?:(\w+)\s+)?\((.+):(\d+):(\d+)\)|at\s+(.+):(\d+):(\d+)/);
    if (match) {
      frames.push({
        function: match[1] || match[5] || '<anonymous>',
        filename: match[2] || match[5],
        lineno: parseInt(match[3] || match[6] || '0', 10),
        colno: parseInt(match[4] || match[7] || '0', 10),
      });
    }
  }
  return frames;
}
