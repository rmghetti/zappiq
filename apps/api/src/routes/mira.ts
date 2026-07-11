/**
 * Mira Prospects — rotas de feature (/api/mira). Todas gated por
 * requireMira() no server.ts (auth + tenant + plano ativo + add-on).
 *
 * Sessão 1 (fundação): Perfil de Prospecção (survey/ICP), fila de
 * Alvos e dossiê, Releases. Os motores (geração de Alvos) entram nas
 * sessões 2 e 3 em services/mira/*.
 */
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '@zappiq/database';
import { validate } from '../middleware/validate.js';
import { getMiraEntitlement } from '../middleware/requireMira.js';

const router = Router();

// ── Perfil de Prospecção (Motor 0) ─────────────────────────────────

// GET /api/mira/perfil — o ICP da org (ou null antes do survey)
router.get('/perfil', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const perfil = await (prisma as any).miraPerfil.findUnique({
      where: { organizationId: req.organizationId! },
    });
    res.json({ success: true, data: perfil });
  } catch (err) {
    next(err);
  }
});

const perfilSchema = z.object({
  segmento: z.string().trim().max(160).optional().nullable(),
  subsegmentos: z.array(z.string().trim().max(160)).max(20).default([]),
  catalogo: z
    .array(
      z.object({
        nome: z.string().trim().min(1).max(160),
        descricao: z.string().trim().max(600).optional().default(''),
        ticketMedio: z.number().nonnegative().optional().nullable(),
      })
    )
    .max(50)
    .default([]),
  diferenciais: z.array(z.string().trim().max(300)).max(20).default([]),
  concorrentes: z.array(z.string().trim().max(160)).max(20).default([]),
  icpFirmografia: z
    .object({
      cnaes: z.array(z.string().trim().max(20)).max(30).default([]),
      portes: z.array(z.string().trim().max(30)).max(10).default([]),
      regioes: z.array(z.string().trim().max(80)).max(30).default([]),
      faturamento: z.string().trim().max(120).optional().nullable(),
    })
    .default({ cnaes: [], portes: [], regioes: [], faturamento: null }),
  icpB2c: z
    .object({
      perfil: z.string().trim().max(600).optional().default(''),
      regioes: z.array(z.string().trim().max(80)).max(30).default([]),
      gatilhos: z.array(z.string().trim().max(200)).max(20).default([]),
    })
    .default({ perfil: '', regioes: [], gatilhos: [] }),
  areasCompradoras: z.array(z.string().trim().max(80)).max(12).default([]),
  modo: z.enum(['B2B', 'B2C']).default('B2B'),
});

/**
 * Prontidão do perfil (0-100): quanto do que os agentes precisam já
 * foi declarado. Pesos: segmento 15, catálogo 25, ICP 30 (firmografia
 * OU B2C conforme o modo), áreas compradoras 15, diferenciais 10,
 * concorrentes 5. Espelha o espírito do aiReadinessScore.
 */
export function computePerfilProntidao(p: z.infer<typeof perfilSchema>): number {
  let score = 0;
  if (p.segmento && p.segmento.length > 2) score += 15;
  if (p.catalogo.length >= 1) score += 15;
  if (p.catalogo.length >= 3) score += 10;
  const icpOk =
    p.modo === 'B2B'
      ? p.icpFirmografia.cnaes.length + p.icpFirmografia.regioes.length + p.icpFirmografia.portes.length >= 2
      : (p.icpB2c.perfil?.length ?? 0) > 10 || p.icpB2c.regioes.length >= 1;
  if (icpOk) score += 30;
  if (p.areasCompradoras.length >= 1) score += 15;
  if (p.diferenciais.length >= 1) score += 10;
  if (p.concorrentes.length >= 1) score += 5;
  return Math.min(100, score);
}

// PUT /api/mira/perfil — upsert do ICP (survey salva por etapas)
router.put('/perfil', validate(perfilSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = req.body as z.infer<typeof perfilSchema>;
    const prontidao = computePerfilProntidao(data);
    const perfil = await (prisma as any).miraPerfil.upsert({
      where: { organizationId: req.organizationId! },
      create: { organizationId: req.organizationId!, ...data, prontidao },
      update: { ...data, prontidao },
    });
    res.json({ success: true, data: perfil });
  } catch (err) {
    next(err);
  }
});

// ── Alvos ──────────────────────────────────────────────────────────

// GET /api/mira/alvos?status=&motor=&q=&take= — fila priorizada
router.get('/alvos', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, motor, q } = req.query as { status?: string; motor?: string; q?: string };
    const take = Math.min(Number((req.query as any).take) || 100, 200);
    const where: any = { organizationId: req.organizationId! };
    if (status) where.status = status;
    if (motor) where.motor = motor;
    if (q && q.trim()) {
      where.OR = [
        { nome: { contains: q.trim(), mode: 'insensitive' } },
        { nomeFantasia: { contains: q.trim(), mode: 'insensitive' } },
        { cnpj: { contains: q.replace(/\D/g, '') || q.trim() } },
      ];
    }
    const alvos = await (prisma as any).miraAlvo.findMany({
      where,
      orderBy: [{ miraScore: { sort: 'desc', nulls: 'last' } }, { updatedAt: 'desc' }],
      take,
      select: {
        id: true,
        nome: true,
        nomeFantasia: true,
        kind: true,
        motor: true,
        status: true,
        cnpj: true,
        cnae: true,
        porte: true,
        municipio: true,
        uf: true,
        miraScore: true,
        confianca: true,
        resumo: true,
        janelaEntrada: true,
        contactId: true,
        dealId: true,
        updatedAt: true,
        _count: { select: { decisores: true, demandas: true, releases: true } },
      },
    });
    const ent = await getMiraEntitlement(req.organizationId!);
    res.json({ success: true, data: { alvos, quota: ent.quota, monthKey: ent.monthKey } });
  } catch (err) {
    next(err);
  }
});

// GET /api/mira/alvos/:id — dossiê completo
router.get('/alvos/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const alvo = await (prisma as any).miraAlvo.findFirst({
      where: { id: req.params.id, organizationId: req.organizationId! },
      include: {
        decisores: { orderBy: { createdAt: 'asc' } },
        demandas: { orderBy: { rank: 'asc' } },
        oportunidades: { orderBy: { rank: 'asc' } },
        incumbentes: true,
        releases: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });
    if (!alvo) {
      res.status(404).json({ success: false, error: 'alvo_not_found' });
      return;
    }
    res.json({ success: true, data: alvo });
  } catch (err) {
    next(err);
  }
});

// ── Releases dos Alvos ─────────────────────────────────────────────

// GET /api/mira/releases?unread=1 — novidades semanais das contas
router.get('/releases', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const unreadOnly = (req.query as any).unread === '1';
    const where: any = { organizationId: req.organizationId! };
    if (unreadOnly) where.lida = false;
    const releases = await (prisma as any).miraRelease.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { alvo: { select: { id: true, nome: true, miraScore: true } } },
    });
    res.json({ success: true, data: releases });
  } catch (err) {
    next(err);
  }
});

// POST /api/mira/releases/:id/lida — marca como lida
router.post('/releases/:id/lida', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const r = await (prisma as any).miraRelease.updateMany({
      where: { id: req.params.id, organizationId: req.organizationId! },
      data: { lida: true },
    });
    res.json({ success: true, data: { updated: r.count } });
  } catch (err) {
    next(err);
  }
});

export default router;
