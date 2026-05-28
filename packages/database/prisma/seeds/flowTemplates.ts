/**
 * Seed manual dos 15 templates. Roda via `pnpm db:seed` ou direto:
 *   pnpm --filter @zappiq/database exec tsx prisma/seeds/flowTemplates.ts
 *
 * Em prod, o bootstrap automatico em apps/api/src/bootstrap/seedFlowTemplates.ts
 * cuida disso no startup do Fly se a tabela estiver vazia.
 *
 * Fonte unica dos templates: packages/database/src/flowTemplatesData.ts
 */

import { PrismaClient, FlowTemplateVertical, FlowTemplateCategory } from '@prisma/client';
import { FLOW_TEMPLATES_DATA } from '../../src/flowTemplatesData';

const prisma = new PrismaClient();

async function main() {
  console.log(`Seedando ${FLOW_TEMPLATES_DATA.length} templates...`);
  for (const t of FLOW_TEMPLATES_DATA) {
    const existing = await prisma.flowTemplate.findFirst({
      where: {
        vertical: t.vertical as FlowTemplateVertical,
        category: t.category as FlowTemplateCategory,
        name: t.name,
      },
    });
    if (existing) {
      console.log(`  - ja existe: ${t.name}`);
      continue;
    }
    await prisma.flowTemplate.create({ data: t as any });
    console.log(`  + ${t.vertical} / ${t.category}: ${t.name}`);
  }
  console.log('Seed completo.');
}

main().catch((err) => { console.error(err); process.exit(1); }).finally(() => prisma.$disconnect());
