interface ErrorContext {
  userId?: string;
  [key: string]: unknown;
}

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;
const isDevelopment = process.env.NODE_ENV === 'development';

export async function reportError(error: Error | unknown, context?: ErrorContext): Promise<void> {
  if (isDevelopment || !SENTRY_DSN) {
    console.error('[Error Report]', error, context);
    return;
  }

  try {
    const err = error instanceof Error ? error : new Error(String(error));
    const url = new URL(SENTRY_DSN);
    const dsnOrigin = `${url.protocol}//${url.host}`;
    const pathParts = url.pathname.split('/');
    const projectId = pathParts[pathParts.length - 1];

    const payload = {
      dsn: SENTRY_DSN,
      message: err.message,
      exception: [
        {
          type: err.name || 'Error',
          value: err.message,
          stacktrace: {
            frames: parseStackTrace(err.stack),
          },
        },
      ],
      level: 'error',
      environment: 'production',
      tags: {
        runtime: 'browser',
      },
      timestamp: Math.floor(Date.now() / 1000),
      user: context?.userId ? { id: context.userId } : undefined,
    };

    const storeUrl = `${dsnOrigin}/api/${projectId}/store/`;
    await fetch(storeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (sendErr) {
    console.warn('[Sentry] Failed to send error report', sendErr);
  }
}

function parseStackTrace(stack?: string): unknown[] {
  const frames: unknown[] = [];
  if (!stack) return frames;

  const lines = stack.split('\n');
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

// Initialize global error handlers
if (typeof window !== 'undefined') {
  window.onerror = (message: string | Event, source?: string, lineno?: number, colno?: number, error?: Error) => {
    reportError(error || new Error(String(message)), {
      source,
      lineno,
      colno,
    });
    return false;
  };

  window.onunhandledrejection = (event: PromiseRejectionEvent) => {
    reportError(event.reason);
    return false;
  };
}
