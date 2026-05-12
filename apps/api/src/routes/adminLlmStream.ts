/**
 * /api/admin/llm-stream-test (PR #V4-004)
 *
 * Endpoint admin SUPERADMIN pra validar streaming end-to-end via SSE.
 * Bate em Sonnet 4.6 com prompt fornecido e devolve chunks como Server-Sent
 * Events. Cliente típico: curl -N --no-buffer ou EventSource no browser.
 *
 * Uso:
 *   curl -N -X POST https://zappiq-api.fly.dev/api/admin/llm-stream-test \
 *     -H "Authorization: Bearer $JWT" \
 *     -H "Content-Type: application/json" \
 *     -d '{"prompt": "Conte uma história em 5 frases sobre WhatsApp e IA"}'
 *
 * NÃO destinado a produção — só dogfooding e validação. Produção entra
 * via webhook/agentOrchestrator em próximo PR atrás de feature flag.
 */

import { Router, Request, Response } from 'express';
import { llmRouter } from '../services/llm/LLMRouter.js';
import { logger } from '../utils/logger.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';

const router = Router();

async function llmStreamTestHandler(req: Request, res: Response) {
  const prompt = String(req.body?.prompt ?? '').trim();
  const system = String(req.body?.system ?? 'Você é a Iza, vendedora top da ZappIQ.').trim();
  const maxTokens = Math.min(Number(req.body?.maxTokens) || 512, 2048);

  if (!prompt) {
    res.status(400).json({ error: 'prompt obrigatório' });
    return;
  }

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable buffering em proxies tipo nginx
  res.flushHeaders?.();

  const writeEvent = (event: string, data: any) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Keepalive pinging — Fly mata conexões idle ~30s
  const keepalive = setInterval(() => {
    res.write(': keepalive\n\n');
  }, 15_000);

  try {
    const stream = llmRouter.completeStream({
      system,
      messages: [{ role: 'user', content: prompt }],
      maxTokens,
      operation: 'chat',
    });

    for await (const chunk of stream) {
      if (chunk.type === 'text-delta') {
        writeEvent('text-delta', { delta: chunk.delta });
      } else if (chunk.type === 'tool-use-start') {
        writeEvent('tool-use-start', { toolCall: chunk.toolCall });
      } else if (chunk.type === 'tool-use-end') {
        writeEvent('tool-use-end', { toolCallId: chunk.toolCallId });
      } else if (chunk.type === 'done') {
        writeEvent('done', {
          text: chunk.final.text,
          provider: chunk.final.provider,
          model: chunk.final.model,
          latencyMs: chunk.final.latencyMs,
          usage: chunk.final.usage,
          attempt: chunk.final.attempt,
        });
      } else if (chunk.type === 'error') {
        writeEvent('error', { error: chunk.error, provider: chunk.provider });
      }
    }
  } catch (err: any) {
    logger.error('[admin/llm-stream-test] erro:', err);
    writeEvent('error', { error: err?.message || 'erro desconhecido' });
  } finally {
    clearInterval(keepalive);
    res.end();
  }
}

router.post(
  '/llm-stream-test',
  authMiddleware as any,
  requireRole('SUPERADMIN') as any,
  llmStreamTestHandler,
);

export default router;
