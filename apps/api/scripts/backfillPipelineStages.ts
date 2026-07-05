/* ══════════════════════════════════════════════════════════════════════
 * backfillPipelineStages (CLI) — fix W3.5 (idempotente).
 * --------------------------------------------------------------------
 * Fino wrapper CLI sobre runBackfillPipelineStages()
 * (services/pipelineStageProvisioningService). Semeia os 7 PipelineStage
 * default das orgs existentes que ainda NÃO têm nenhum — em prod, as orgs
 * criadas depois de 24/05/2026 (incl. CMJ) nasceram sem estágios, porque os
 * estágios só existiam como backfill da migração 20260524. Sem estágios, o
 * PUT /deals/:id/stage não sincroniza o stageId (falha em silêncio).
 *
 * A lógica vive no service (reusada pelo registro e pelo onboarding). Este
 * script só é o ponto de entrada manual — NÃO deve ser executado por
 * workflow, só deixado pronto para o Rodrigo rodar.
 *
 * Uso (manual, quando o Rodrigo decidir):
 *   pnpm --filter @zappiq/api tsx scripts/backfillPipelineStages.ts
 *   (dry-run) BACKFILL_DRY_RUN=1 pnpm --filter @zappiq/api tsx scripts/backfillPipelineStages.ts
 * ══════════════════════════════════════════════════════════════════════ */

import { prisma } from '@zappiq/database';
import { runBackfillPipelineStages } from '../src/services/pipelineStageProvisioningService.js';

const DRY = process.env.BACKFILL_DRY_RUN === '1';

async function main() {
  console.log(`[backfillPipelineStages] início${DRY ? ' (DRY RUN)' : ''}`);
  const r = await runBackfillPipelineStages({ dryRun: DRY });
  console.log(
    `[backfillPipelineStages] concluído em ${r.durationMs}ms — ` +
      `scanned=${r.scanned} seeded=${r.seeded} skipped=${r.skipped}`,
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('[backfillPipelineStages] ERRO:', err);
    await prisma.$disconnect();
    process.exit(1);
  });
