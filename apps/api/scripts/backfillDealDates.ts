/* ══════════════════════════════════════════════════════════════════════
 * backfillDealDates (CLI) — fix W3.6 (idempotente).
 * --------------------------------------------------------------------
 * Preenche as datas de fechamento dos deals ÓRFÃOS: aqueles que estão em
 * stage 'won'/'lost' mas ficaram sem wonAt/lostAt/closedAt porque foram
 * criados direto em Ganho/Perdido pelo modal (POST /api/deals) antes do fix.
 * Sem essas datas, o deal some das métricas de fechamento (que filtram por
 * wonAt/lostAt/closedAt).
 *
 * Regra (idêntica ao handler): won → closedAt + wonAt; lost → closedAt + lostAt.
 * Fallback da data: usa updatedAt do deal (melhor aproximação do momento em
 * que ele entrou em won/lost); se por algum motivo faltar, usa createdAt.
 *
 * IDEMPOTENTE: só toca deals cuja respectiva data ainda é null. Rodar duas
 * vezes não muda nada na segunda.
 *
 * NÃO deve ser executado por workflow — só deixado pronto para o Rodrigo rodar.
 *
 * Uso (manual, quando o Rodrigo decidir):
 *   pnpm --filter @zappiq/api tsx scripts/backfillDealDates.ts
 *   (dry-run) BACKFILL_DRY_RUN=1 pnpm --filter @zappiq/api tsx scripts/backfillDealDates.ts
 * ══════════════════════════════════════════════════════════════════════ */

import { prisma } from '@zappiq/database';

const DRY = process.env.BACKFILL_DRY_RUN === '1';

async function main() {
  const started = Date.now();
  console.log(`[backfillDealDates] início${DRY ? ' (DRY RUN)' : ''}`);

  // Deals órfãos: em won/lost porém sem a data correspondente preenchida.
  const orphans = await prisma.deal.findMany({
    where: {
      OR: [
        { stage: 'won', OR: [{ wonAt: null }, { closedAt: null }] },
        { stage: 'lost', OR: [{ lostAt: null }, { closedAt: null }] },
      ],
    },
    select: { id: true, stage: true, wonAt: true, lostAt: true, closedAt: true, createdAt: true, updatedAt: true },
  });

  let won = 0;
  let lost = 0;

  for (const d of orphans) {
    const when = d.updatedAt ?? d.createdAt ?? new Date();
    const data: { wonAt?: Date; lostAt?: Date; closedAt?: Date } = {};

    if (d.stage === 'won') {
      if (d.wonAt == null) data.wonAt = when;
      if (d.closedAt == null) data.closedAt = when;
      won++;
    } else if (d.stage === 'lost') {
      if (d.lostAt == null) data.lostAt = when;
      if (d.closedAt == null) data.closedAt = when;
      lost++;
    }

    if (Object.keys(data).length === 0) continue;

    if (DRY) {
      console.log(`[backfillDealDates] (dry) deal=${d.id} stage=${d.stage} ->`, data);
    } else {
      await prisma.deal.update({ where: { id: d.id }, data });
    }
  }

  console.log(
    `[backfillDealDates] concluído em ${Date.now() - started}ms — ` +
      `scanned=${orphans.length} won=${won} lost=${lost}${DRY ? ' (nada gravado)' : ''}`,
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('[backfillDealDates] ERRO:', err);
    await prisma.$disconnect();
    process.exit(1);
  });
