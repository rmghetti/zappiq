/* ══════════════════════════════════════════════════════════════════════
 * backfillCrmAccounts (CLI) — Área Clientes / Fase 1 (idempotente).
 * --------------------------------------------------------------------
 * Fino wrapper CLI sobre runBackfillCrmAccounts() (services/backfillCrmAccountsService).
 * A lógica vive no service para ser reusada pelo endpoint POST
 * /api/admin/clientes/backfill (Fase 2). Este script só é o ponto de entrada
 * manual — não deve ser executado por workflow, só deixado pronto.
 *
 * Uso (manual, quando o Rodrigo decidir):
 *   pnpm --filter @zappiq/api tsx scripts/backfillCrmAccounts.ts
 *   (dry-run) BACKFILL_DRY_RUN=1 pnpm --filter @zappiq/api tsx scripts/backfillCrmAccounts.ts
 * ══════════════════════════════════════════════════════════════════════ */

import { prisma } from '@zappiq/database';
import { runBackfillCrmAccounts } from '../src/services/backfillCrmAccountsService.js';

const DRY = process.env.BACKFILL_DRY_RUN === '1';

async function main() {
  console.log(`[backfillCrmAccounts] início${DRY ? ' (DRY RUN)' : ''}`);
  const r = await runBackfillCrmAccounts({ dryRun: DRY });
  console.log(
    `[backfillCrmAccounts] concluído em ${r.durationMs}ms — ` +
      `linked=${r.linked} orgAccounts=${r.orgAccounts} signupAccounts=${r.signupAccounts}`,
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('[backfillCrmAccounts] ERRO:', err);
    await prisma.$disconnect();
    process.exit(1);
  });
