/* ══════════════════════════════════════════════════════════════════════
 * backfillAgents (CLI) — W1.5 (idempotente).
 * --------------------------------------------------------------------
 * Fino wrapper CLI sobre runBackfillAgents() (services/agentProvisioningService).
 * Semeia o Agent live 'comercial' das orgs existentes que ainda não têm — em
 * prod, 15/16 orgs caíram no fallback do orchestrator por falta de Agent.
 *
 * A lógica vive no service (reusada pelo onboarding). Este script só é o ponto
 * de entrada manual — NÃO deve ser executado por workflow, só deixado pronto.
 *
 * Uso (manual, quando o Rodrigo decidir):
 *   pnpm --filter @zappiq/api tsx scripts/backfillAgents.ts
 *   (dry-run) BACKFILL_DRY_RUN=1 pnpm --filter @zappiq/api tsx scripts/backfillAgents.ts
 * ══════════════════════════════════════════════════════════════════════ */

import { prisma } from '@zappiq/database';
import { runBackfillAgents } from '../src/services/agentProvisioningService.js';

const DRY = process.env.BACKFILL_DRY_RUN === '1';

async function main() {
  console.log(`[backfillAgents] início${DRY ? ' (DRY RUN)' : ''}`);
  const r = await runBackfillAgents({ dryRun: DRY });
  console.log(
    `[backfillAgents] concluído em ${r.durationMs}ms — ` +
      `scanned=${r.scanned} created=${r.created} skipped=${r.skipped}`,
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('[backfillAgents] ERRO:', err);
    await prisma.$disconnect();
    process.exit(1);
  });
