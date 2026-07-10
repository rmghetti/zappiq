/**
 * Iza Ajuda — chat de suporte da plataforma (Fase 2).
 *
 * Endpoint autenticado que responde dúvidas do CLIENTE sobre como usar a ZappIQ,
 * com base no corpus de ajuda (registro Saiba mais clientSafe). Fronteira de
 * segurança: só ajuda de plataforma, nunca admin/interno (ver services/izaAjuda/prompt.ts).
 *
 * Segue o padrão do playground de IA: valida input, chama o LLM, limpa a saída
 * com o filtro de voz humana. Não usa o RAG multi-tenant (a base é compartilhada
 * e estática), nem cria Conversation/Contact.
 */
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { logger } from '../utils/logger.js';
import { llmRouter } from '../services/llm/LLMRouter.js';
import { applyVozHumanaFilter } from '../agents/vozHumanaFilter.js';
import { retrieve } from '../services/izaAjuda/retrieval.js';
import { IZA_AJUDA_SYSTEM, buildUserMessage } from '../services/izaAjuda/prompt.js';

const router = Router();

const chatSchema = z.object({
  message: z.string().min(1).max(1000),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(2000),
      }),
    )
    .max(10)
    .optional(),
});

router.post('/chat', validate(chatSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.organizationId;
    const { message, history = [] } = req.body as {
      message: string;
      history?: Array<{ role: 'user' | 'assistant'; content: string }>;
    };

    // 1. Recupera os trechos de ajuda mais relevantes (corpus clientSafe).
    const scored = retrieve(message, 6);
    const docs = scored.map((s) => s.doc);

    // 2. Monta a conversa: system de guardrail + histórico curto + pergunta com contexto.
    const messages = [
      ...history.map((h) => ({ role: h.role, content: h.content })),
      { role: 'user' as const, content: buildUserMessage(message, docs) },
    ];

    // 3. Chama o LLM. temperatura baixa: ajuda factual, não criativa.
    const resp = await llmRouter.complete({
      system: IZA_AJUDA_SYSTEM,
      messages,
      maxTokens: 600,
      temperature: 0.2,
      orgId,
      operation: 'chat',
    });

    // 4. Limpa a saída no mesmo padrão do resto do produto (voz humana, sem travessão).
    const reply = applyVozHumanaFilter(resp.text ?? '').trim();

    // 5. Fontes = os recursos citados, pra oferecer "Saiba mais" no widget.
    const sources = docs.map((d) => ({ featureKey: d.featureKey, titulo: d.titulo }));

    res.json({ reply, sources });
  } catch (err) {
    logger.warn('[IzaAjuda] chat falhou', { err: String(err) });
    next(err);
  }
});

export default router;
