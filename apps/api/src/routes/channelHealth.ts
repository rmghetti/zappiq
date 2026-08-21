/**
 * /api/channel-health (Resposta Meta out/2026, PR-D).
 *
 * Leitura do histórico da varredura de saúde do WABA (wabaHealthService,
 * fila cron `waba-health` a cada 6h). É a base do card "seu canal NÃO está
 * no ar" do dash: devolve o último check da org + histórico curto.
 *
 * Qualquer usuário autenticado da org enxerga (o card é status operacional,
 * sem credencial nenhuma no payload: detail guarda só o resumo do check).
 * Tenancy: filtro explícito por organizationId do JWT, como nas rotas
 * vizinhas (em produção a RLS não filtra sozinha, ver rlsTenant.ts).
 */
import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '@zappiq/database';

const router = Router();

/** Tamanho do histórico curto devolvido pro card. */
const HISTORY_SIZE = 10;

// ── GET /api/channel-health: último check + últimos 10 ─────────
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const checks = await prisma.channelHealthCheck.findMany({
      where: { organizationId: req.organizationId! },
      orderBy: { checkedAt: 'desc' },
      take: HISTORY_SIZE,
      select: {
        id: true,
        channel: true,
        ok: true,
        qualityRating: true,
        messagingTier: true,
        errorCode: true,
        detail: true,
        checkedAt: true,
      },
    });

    res.json({
      success: true,
      data: {
        // latest = null enquanto a varredura ainda não passou pela org
        // (canal recém configurado ou org sem canal próprio).
        latest: checks[0] ?? null,
        history: checks,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
