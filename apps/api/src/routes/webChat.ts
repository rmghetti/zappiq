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
// Resposta Meta out/2026 (PR-E): limitador por org (300/h) pra org em regime
// TRIAL/NOVO. Org pagante e org da ZappIQ ficam de fora (capped=false).
import {
  getTrialLlmStage,
  consumeWebChatOrgReplyBudget,
} from '../middleware/planLimits.js';
// C1b (Passo 3): o visitante que voltou vê a resposta humana que chegou
// enquanto ele estava fora. A sessão é a mesma que o widget guarda.
import { mensagensDaEquipe } from '../services/webChatVisitante.js';
import { sessaoNormalizada } from '../services/webChatSala.js';

const router = Router();

/*
 * Resposta Meta out/2026 (PR-E): HONEYPOT anti-bot.
 * O campo opcional `website` não existe no formulário visível do widget:
 * humano não preenche, bot de spam preenche. Quando vier preenchido, a rota
 * devolve 200 com um texto genérico SEM processar LLM (o bot acha que
 * funcionou e não insiste). A mudança do widget pra enviar o campo fica fora
 * deste backend: aqui apenas toleramos e usamos quando vier.
 */
const HONEYPOT_REPLY = 'Recebi sua mensagem. Obrigado pelo contato, em breve retornamos.';

function isHoneypotHit(website: string | undefined): boolean {
  return typeof website === 'string' && website.trim().length > 0;
}

// Rate-limit dedicado: 30 mensagens / 5 min por IP. Mais permissivo que o
// authLimiter (10/15min) mas restritivo o suficiente pra impedir scraping.
const webChatLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas mensagens em pouco tempo. Tenta de novo em 5 min.' },
});

// C1b: leituras do widget (mensagens da equipe e, no Passo 4, o nome e a
// saudação). O script roda em toda página do site do cliente e relê ao
// abrir o painel: limite próprio, separado do POST que chama o modelo.
const leituraDoWidgetLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas leituras em pouco tempo. Tenta de novo em 5 min.' },
});

/** Id de organização que o widget manda na URL, validado como no POST. */
function orgDaUrl(bruto: unknown): string | null {
  const id = String(bruto || '').trim();
  return id && id.length <= 40 ? id : null;
}

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
  // HONEYPOT (PR-E): campo invisível pro humano. Preenchido = bot.
  website: z.string().max(200).optional(),
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

  const { sessionId, message, history, website } = parsed.data;

  // HONEYPOT (PR-E): bot preencheu o campo invisível. 200 genérico, zero LLM.
  if (isHoneypotHit(website)) {
    logger.warn('[webChat] honeypot acionado no /iza-message', { sessionId });
    return res.json({ reply: HONEYPOT_REPLY, latencyMs: 0 });
  }

  try {
    // A190: `history` do corpo é ignorado pelo serviço (o histórico vem do que
    // o servidor gravou). Segue sendo aceito para o widget já publicado não
    // quebrar. `paused` avisa que um atendente assumiu a conversa.
    const result = await processWebChatTurn({ sessionId, message, history });
    res.json({
      reply: result.reply,
      paused: result.paused === true,
      transbordo: result.transbordo === true,
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

  const { sessionId, message, history, website } = parsed.data;

  // HONEYPOT (PR-E): bot preencheu o campo invisível. 200 genérico, zero LLM.
  if (isHoneypotHit(website)) {
    logger.warn('[webChat] honeypot acionado no webchat por org', { sessionId, organizationId });
    return res.json({ reply: HONEYPOT_REPLY, latencyMs: 0 });
  }

  // Rate limit por ORG (PR-E), além do por IP acima: 300 mensagens/hora pra
  // org em regime TRIAL/NOVO. Um flood distribuído (vários IPs) não estoura o
  // custo de LLM de um tenant em teste. Org pagante segue sem esse teto.
  const trialStage = await getTrialLlmStage(organizationId);
  if (trialStage.capped) {
    const orgBudget = await consumeWebChatOrgReplyBudget(organizationId);
    if (!orgBudget.allowed) {
      logger.warn(
        `[webChat] rate limit por org no ${trialStage.stage}: ${orgBudget.count}/300 na última hora`,
        { organizationId },
      );
      return res.status(429).json({
        error: 'rate_limited',
        reply: 'Estamos recebendo muitas mensagens agora. Tenta de novo em alguns minutos?',
      });
    }
  }

  try {
    const result = await processWebChatTurn({ sessionId, message, history, organizationId });
    res.json({
      reply: result.reply,
      paused: result.paused === true,
      transbordo: result.transbordo === true,
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

/* GET /api/web-chat/org/:organizationId/sessao/:sessionId/mensagens-da-equipe
 * C1b (Passo 3, A158): as respostas que a equipe escreveu pelo Inbox para
 * esta sessão. O widget recebe ao vivo pelo socket; esta leitura cobre o
 * visitante que estava fora quando a resposta saiu. Mesmo portão do POST:
 * organização existente e com o chat do site ligado, senão 404 genérico.
 */
router.get(
  '/org/:organizationId/sessao/:sessionId/mensagens-da-equipe',
  leituraDoWidgetLimiter,
  async (req: Request, res: Response) => {
    const organizationId = orgDaUrl(req.params.organizationId);
    const sessao = sessaoNormalizada(req.params.sessionId);
    if (!organizationId || !sessao) return res.status(404).json({ error: 'not_found' });

    try {
      const config = await getWebChatOrgConfig(organizationId);
      if (!config.exists || !config.enabled) return res.status(404).json({ error: 'not_found' });
      res.set('Cache-Control', 'no-store');
      return res.json({ mensagens: await mensagensDaEquipe(organizationId, sessao) });
    } catch (err: any) {
      logger.warn('[webChat] leitura das mensagens da equipe falhou', { organizationId, err: err?.message });
      return res.status(503).json({ error: 'unavailable' });
    }
  },
);

export default router;
