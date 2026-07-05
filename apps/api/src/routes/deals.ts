import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '@zappiq/database';
import { validate } from '../middleware/validate.js';
import { pendingSuggestions } from '../services/dealAttribution.js';
import { normalizeLossReason } from './deals.lossreason.util.js';
import { closingDatesForStage } from './deals.closedates.util.js';
import { createDealSchema, updateDealSchema } from './deals.schema.js';

const router = Router();

// CRUD
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { stage } = req.query;
    const deals = await prisma.deal.findMany({
      where: {
        organizationId: req.organizationId!,
        ...(stage ? { stage: stage as string } : {}),
      },
      orderBy: { updatedAt: 'desc' },
      include: { contact: { select: { id: true, name: true, phone: true, avatarUrl: true } } },
    });
    res.json({ success: true, data: deals });
  } catch (err) { next(err); }
});

router.post('/', validate(createDealSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.organizationId!;
    const { title, value, stage, contactId } = req.body;
    // IDOR: garante que o contato pertence à MESMA org antes de criar o deal.
    // Sem isso dava pra criar um deal cross-tenant apontando pra contato alheio.
    const contact = await prisma.contact.findFirst({
      where: { id: contactId, organizationId: orgId },
      select: { id: true },
    });
    if (!contact) { res.status(404).json({ error: 'Contact not found' }); return; }
    // W3.6: se o deal já nasce em 'won'/'lost' (criação direta pelo modal),
    // aplica a MESMA lógica de datas do PUT /:id/stage — senão o deal fica sem
    // wonAt/lostAt/closedAt e some das métricas de fechamento.
    const closingDates = closingDatesForStage(stage);
    const deal = await prisma.deal.create({
      data: { title, value, stage, contactId, organizationId: orgId, ...closingDates },
    });
    res.status(201).json({ success: true, data: deal });
  } catch (err) { next(err); }
});

// ── Fase B: atribuição IA — vínculo conversa→deal (human-in-the-loop) ──
// GET /api/deals/ia-suggestions — deals com candidato de conversa aguardando confirmação
router.get('/ia-suggestions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await pendingSuggestions(req.organizationId!);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// POST /api/deals/:id/link-conversation { conversationId } — confirma o vínculo
router.post('/:id/link-conversation', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.organizationId!;
    const { conversationId } = req.body;
    if (!conversationId) { res.status(400).json({ error: 'conversationId é obrigatório' }); return; }
    const [deal, conv] = await Promise.all([
      prisma.deal.findFirst({ where: { id: req.params.id, organizationId: orgId } }),
      prisma.conversation.findFirst({ where: { id: conversationId, organizationId: orgId } }),
    ]);
    if (!deal || !conv) { res.status(404).json({ error: 'Deal ou conversa não encontrados' }); return; }
    const updated = await prisma.deal.update({
      where: { id: deal.id },
      data: { sourceConversationId: conversationId, aiLinkReviewed: true },
    });
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

// POST /api/deals/:id/reject-ia-link — rejeita a sugestão (não volta a sugerir)
router.post('/:id/reject-ia-link', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.organizationId!;
    const deal = await prisma.deal.findFirst({ where: { id: req.params.id, organizationId: orgId } });
    if (!deal) { res.status(404).json({ error: 'Deal não encontrado' }); return; }
    const updated = await prisma.deal.update({ where: { id: deal.id }, data: { aiLinkReviewed: true } });
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const deal = await prisma.deal.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId! },
      include: { contact: true },
    });
    if (!deal) { res.status(404).json({ error: 'Deal not found' }); return; }
    res.json({ success: true, data: deal });
  } catch (err) { next(err); }
});

router.put('/:id', validate(updateDealSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.organizationId!;
    const data = req.body; // já validado + whitelistado (.strict()) pelo updateDealSchema
    // Se estiver trocando o contato, o novo contato tem que ser da mesma org (IDOR).
    if (data.contactId !== undefined) {
      const contact = await prisma.contact.findFirst({
        where: { id: data.contactId, organizationId: orgId },
        select: { id: true },
      });
      if (!contact) { res.status(404).json({ error: 'Contact not found' }); return; }
    }
    const result = await prisma.deal.updateMany({ where: { id: req.params.id, organizationId: orgId }, data });
    if (result.count === 0) { res.status(404).json({ error: 'Deal not found' }); return; }
    const updated = await prisma.deal.findFirst({ where: { id: req.params.id, organizationId: orgId } });
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await prisma.deal.deleteMany({ where: { id: req.params.id, organizationId: req.organizationId! } });
    if (result.count === 0) { res.status(404).json({ error: 'Deal not found' }); return; }
    res.json({ success: true, message: 'Deal deleted' });
  } catch (err) { next(err); }
});

// Mapa: chave do kanban (legado) -> nome do PipelineStage (CRM Onda 0).
// Mantém o campo legado `stage` (string) e o `stageId` (FK) em sincronia, pra
// o painel de contexto das Conversas refletir o mesmo estágio do kanban.
const STAGE_KEY_TO_PIPELINE: Record<string, string> = {
  new: 'Novo lead',
  contatado: 'Contatado',
  qualified: 'Qualificado',
  proposal: 'Proposta',
  negotiation: 'Negociacao',
  won: 'Ganho',
  lost: 'Perdido',
};

// PUT /api/deals/:id/stage
router.put('/:id/stage', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // PR #220 (CRM 3c) + fix 05/07: lossReason opcional capturado pelo modal ao
    // arrastar deal pra coluna 'Perdido'. Enum LossReason (UPPERCASE): PRICE |
    // COMPETITOR | TIMING | NO_DECISION | NO_BUDGET | NO_RESPONSE | OTHER.
    // normalizeLossReason aceita caixa qualquer e só grava valor real do enum
    // (antes a lista era minúscula + tinha 'not_qualified' inexistente → 500).
    const { stage, lossReason } = req.body;
    if (!stage) { res.status(400).json({ error: 'stage is required' }); return; }
    const validLossReason = normalizeLossReason(stage, lossReason);

    // Resolve o PipelineStage correspondente na org (mantém stageId em sincronia).
    const pipelineName = STAGE_KEY_TO_PIPELINE[stage as string];
    const ps = pipelineName
      ? await prisma.pipelineStage.findFirst({
          where: { organizationId: req.organizationId!, name: pipelineName },
          select: { id: true },
        })
      : null;

    // W3.6: mesma lógica de datas compartilhada com o POST (deal que já nasce fechado).
    const result = await prisma.deal.updateMany({
      where: { id: req.params.id, organizationId: req.organizationId! },
      data: {
        stage,
        ...(ps ? { stageId: ps.id } : {}),
        ...closingDatesForStage(stage as string),
        ...(validLossReason ? { lossReason: validLossReason as any } : {}),
      },
    });
    if (result.count === 0) { res.status(404).json({ error: 'Deal not found' }); return; }
    res.json({ success: true, message: `Deal moved to ${stage}` });
  } catch (err) { next(err); }
});

export default router;
