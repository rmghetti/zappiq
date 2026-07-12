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
import { runMotorA, crmCandidates } from '../services/mira/motorA.js';
import { pousarNoCrm } from '../services/mira/pousarCrm.js';
import { runMotorB, placesDisponivel } from '../services/mira/motorB.js';
import { runDescobertaPublica } from '../services/mira/descobertaPublica.js';
import { buscaPublicaDisponivel, buscaPublicaProvider } from '../services/mira/buscaPublica.js';
import { enriquecerDecisoresPublico } from '../services/mira/decisoresPublico.js';
import { aprofundarAlvo } from '../services/mira/agentes.js';

const router = Router();

// ── Motor A (base instalada) ───────────────────────────────────────

const motorASchema = z.object({
  cnpjs: z.array(z.string().trim().min(11).max(20)).min(1).max(50),
});

// POST /api/mira/motor-a/run — mapeia uma lista de CNPJs da carteira
router.post('/motor-a/run', validate(motorASchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { cnpjs } = req.body as z.infer<typeof motorASchema>;
    const result = await runMotorA(req.organizationId!, cnpjs);
    res.json({ success: true, data: result });
  } catch (err: any) {
    if (err?.status === 412) {
      res.status(412).json({
        success: false,
        error: 'perfil_incompleto',
        message: 'Complete o Perfil de Prospecção (mínimo 60%) para os motores largarem.',
      });
      return;
    }
    next(err);
  }
});

// GET /api/mira/motor-a/crm-candidates — CNPJs achados no CRM (customFields)
router.get('/motor-a/crm-candidates', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await crmCandidates(req.organizationId!);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// ── Motor B (descoberta net-new) ───────────────────────────────────

const motorBSchema = z.object({
  consulta: z.string().trim().min(3).max(160),
  regiao: z.string().trim().max(120).optional().nullable(),
  // B2B = descoberta pública (busca + Receita/BrasilAPI, grátis).
  // B2C = negócio local (Google Places). Default segue o modo do perfil.
  kind: z.enum(['B2B', 'B2C']).optional(),
});

// GET /api/mira/motor-b/status — quais fontes de descoberta estão ativas
router.get('/motor-b/status', async (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      // B2C local — Google Places (opcional, pago). Sem chave = desabilitado.
      places: placesDisponivel(),
      // B2B — descoberta pública gratuita (busca no índice + verificação na
      // Receita). Ativa quando há um provedor de busca configurado.
      buscaPublica: buscaPublicaDisponivel(),
      provider: buscaPublicaProvider(),
    },
  });
});

// POST /api/mira/motor-b/descobrir — descoberta net-new (B2B público ou B2C Places)
router.post('/motor-b/descobrir', validate(motorBSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { consulta, regiao, kind } = req.body as z.infer<typeof motorBSchema>;
    const perfil = await (prisma as any).miraPerfil.findUnique({ where: { organizationId: req.organizationId! } });
    const modo = kind ?? (perfil?.modo === 'B2C' ? 'B2C' : 'B2B');
    const result =
      modo === 'B2C'
        ? await runMotorB(req.organizationId!, consulta, regiao ?? null)
        : await runDescobertaPublica(req.organizationId!, consulta, regiao ?? null);
    res.json({ success: true, data: { modo, ...result } });
  } catch (err: any) {
    if (err?.status === 501) {
      res.status(501).json({
        success: false,
        error: 'fonte_indisponivel',
        message:
          'Esta fonte de descoberta ainda não está habilitada nesta instalação (B2B precisa de um provedor de busca; B2C local precisa do Google Places). O time já foi avisado.',
      });
      return;
    }
    if (err?.status === 412) {
      res.status(412).json({
        success: false,
        error: 'perfil_incompleto',
        message: 'Complete o Perfil de Prospecção (mínimo 60%) para os motores largarem.',
      });
      return;
    }
    if (err?.status === 502) {
      res.status(502).json({ success: false, error: 'places_erro', message: 'A fonte de descoberta falhou agora. Tente novamente.' });
      return;
    }
    next(err);
  }
});

// POST /api/mira/alvos/:id/aprofundar — agentes de qualificação profunda
router.post('/alvos/:id/aprofundar', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await aprofundarAlvo(req.organizationId!, req.params.id);
    res.json({ success: true, data: result });
  } catch (err: any) {
    if (err?.status === 404) {
      res.status(404).json({ success: false, error: 'alvo_not_found' });
      return;
    }
    if (err?.status === 412) {
      res.status(412).json({
        success: false,
        error: 'catalogo_vazio',
        message: 'Cadastre o catálogo no Perfil de Prospecção para a análise de portfólio.',
      });
      return;
    }
    next(err);
  }
});

// POST /api/mira/alvos/:id/decisores-publico — mapeia decisores por pegada
// pública (índice de busca + páginas públicas). Nunca usa conta logada.
router.post('/alvos/:id/decisores-publico', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await enriquecerDecisoresPublico(req.organizationId!, req.params.id);
    res.json({ success: true, data: result });
  } catch (err: any) {
    if (err?.status === 404) {
      res.status(404).json({ success: false, error: 'alvo_not_found' });
      return;
    }
    if (err?.status === 501) {
      res.status(501).json({
        success: false,
        error: 'fonte_indisponivel',
        message:
          'O mapeamento de decisores por pegada pública precisa de um provedor de busca configurado (ex.: Google Programmable Search, grátis). O time já foi avisado.',
      });
      return;
    }
    next(err);
  }
});

// POST /api/mira/alvos/:id/crm — pousa o Alvo no CRM (Contact + Deal)
router.post('/alvos/:id/crm', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await pousarNoCrm(req.organizationId!, req.params.id);
    res.json({ success: true, data });
  } catch (err: any) {
    if (err?.status === 404) {
      res.status(404).json({ success: false, error: 'alvo_not_found' });
      return;
    }
    if (err?.status === 409) {
      res.status(409).json({
        success: false,
        error: 'alvo_nao_pronto',
        message: 'Só Alvos prontos (verificados) pousam no CRM.',
      });
      return;
    }
    next(err);
  }
});

// POST /api/mira/alvos/:id/arquivar — descarta um Alvo da fila
router.post('/alvos/:id/arquivar', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const r = await (prisma as any).miraAlvo.updateMany({
      where: { id: req.params.id, organizationId: req.organizationId! },
      data: { status: 'ARCHIVED' },
    });
    if (r.count === 0) {
      res.status(404).json({ success: false, error: 'alvo_not_found' });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

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
