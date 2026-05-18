/* ══════════════════════════════════════════════════════════════════════════
 * webChat — endpoint público pro chat in-page do site zappiq.com.br
 * --------------------------------------------------------------------------
 * Mesmo agente Iza (system prompt v7.6 + CORE_AGENT_RULES_V1) do WhatsApp.
 * Sem auth — visitante anônimo. Rate-limit por IP pra defender contra abuso.
 * ══════════════════════════════════════════════════════════════════════════ */

import { Router, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { logger } from '../utils/logger.js';
import {
  processWebChatTurn,
  MAX_HISTORY_TURNS,
  MAX_MESSAGE_LENGTH,
} from '../services/webChatService.js';

const router = Router();

// Rate-limit dedicado: 30 mensagens / 5 min por IP. Mais permissivo que o
// authLimiter (10/15min) mas restritivo o suficiente pra impedir scraping.
const webChatLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas mensagens em pouco tempo. Tenta de novo em 5 min.' },
});

const webChatSchema = z.object({
  sessionId: z.string().trim().min(1).max(64),
  message: z.string().trim().min(1).max(MAX_MESSAGE_LENGTH),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1).max(MAX_MESSAGE_LENGTH),
      }),
    )
    .max(MAX_HISTORY_TURNS * 2) // user+assistant pairs
    .optional()
    .default([]),
});

/* POST /api/web-chat/iza-message
 * Body: { sessionId: string, message: string, history?: [{role, content}] }
 * Resp: { reply: string, provider?: string, model?: string, latencyMs: number }
 */
router.post('/iza-message', webChatLimiter, async (req: Request, res: Response) => {
  const parsed = webChatSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'invalid_request',
      details: parsed.error.flatten(),
    });
  }

  const { sessionId, message, history } = parsed.data;

  try {
    const result = await processWebChatTurn({ sessionId, message, history });
    res.json({
      reply: result.reply,
      provider: result.provider,
      model: result.model,
      latencyMs: result.latencyMs,
    });
  } catch (err: any) {
    const msg = err?.message || 'unknown';
    logger.error('[webChat] handler failed', { sessionId, err: msg });
    if (msg === 'LLM_UNAVAILABLE') {
      return res.status(503).json({
        error: 'llm_unavailable',
        reply:
          'Tô com uma instabilidade aqui agora. Posso te chamar no WhatsApp pra continuar? https://wa.me/5511926160159',
      });
    }
    return res.status(500).json({ error: 'internal_error' });
  }
});

export default router;
