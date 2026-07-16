/**
 * Seed manual dos templates Maestro. Roda via `pnpm db:seed` ou direto:
 *   pnpm --filter @zappiq/database exec tsx prisma/seeds/flowTemplates.ts
 *
 * Em prod nao precisa: o bootstrap do API (apps/api/src/bootstrap/seedFlowTemplates.ts)
 * roda a MESMA regra no startup, todo deploy.
 *
 * Fonte unica dos templates: packages/database/src/flowTemplatesData.ts
 * Regra de semeadura (upsert por vertical+category): src/flowTemplatesUpsert.ts
 */

import { PrismaClient } from '@prisma/client';
import { FLOW_TEMPLATES_DATA } from '../../src/flowTemplatesData';
import { upsertFlowTemplates, formatUpsertResult } from '../../src/flowTemplatesUpsert';

const prisma = new PrismaClient();

async function main() {
  console.log(`Semeando ${FLOW_TEMPLATES_DATA.length} templates...`);
  const r = await upsertFlowTemplates(prisma, {
    info: (m) => console.log(m),
    error: (m) => console.error(m),
  });
  console.log(`Seed completo: ${formatUpsertResult(r)}`);
  if (r.failed > 0) process.exit(1);
}

main().catch((err) => { console.error(err); process.exit(1); }).finally(() => prisma.$disconnect());
