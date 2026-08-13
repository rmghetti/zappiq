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
  getWebChatOrgConfig,
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

/* ══════════════════════════════════════════════════════════════════════════
 * FEATURE webchat-por-org — widget embedável no site de UM CLIENTE ZappIQ
 * --------------------------------------------------------------------------
 * Generalização do /iza-message: mesmo agente vivo do org (role='comercial',
 * status='live'), mesma cascade de LLM, mesmo rate-limit. Diferença: a org
 * é lida da URL, não fixa. Opt-in por org via `settings.webChatEnabled`
 * (default false) — nenhum tenant ganha esse endpoint público sem ligar.
 * Primeiro uso: CMJ (Vera) embedado em cmj.com.br no lugar do botão de
 * WhatsApp — ver LOG do projeto CMJ, 2026-08-11.
 * ══════════════════════════════════════════════════════════════════════════ */

router.post('/org/:organizationId/message', webChatLimiter, async (req: Request, res: Response) => {
  const organizationId = String(req.params.organizationId || '').trim();
  if (!organizationId || organizationId.length > 40) {
    return res.status(404).json({ error: 'not_found' });
  }

  const parsed = webChatSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'invalid_request',
      details: parsed.error.flatten(),
    });
  }

  // Opt-in obrigatório: org precisa existir E ter settings.webChatEnabled=true.
  // 404 genérico nos dois casos (não vaza se o ID existe mas está desligado).
  const config = await getWebChatOrgConfig(organizationId);
  if (!config.exists || !config.enabled) {
    return res.status(404).json({ error: 'not_found' });
  }

  const { sessionId, message, history } = parsed.data;

  try {
    const result = await processWebChatTurn({ sessionId, message, history, organizationId });
    res.json({
      reply: result.reply,
      provider: result.provider,
      model: result.model,
      latencyMs: result.latencyMs,
    });
  } catch (err: any) {
    const msg = err?.message || 'unknown';
    logger.error('[webChat] org handler failed', { sessionId, organizationId, err: msg });
    if (msg === 'LLM_UNAVAILABLE') {
      return res.status(503).json({
        error: 'llm_unavailable',
        reply: 'Tô com uma instabilidade aqui agora. Tenta de novo em instantes?',
      });
    }
    return res.status(500).json({ error: 'internal_error' });
  }
});

export default router;
