/**
 * Bootstrap idempotente: SMART UPSERT pros templates Maestro.
 *
 * Estrategia: compara FLOW_TEMPLATES_DATA (codigo) com flow_templates
 * (DB) por (vertical, category, name). Insere SOMENTE os faltantes.
 * Os existentes ficam intactos.
 *
 * Roda no startup do API. Idempotente: ok rodar todo deploy.
 *
 * Resultado: deploys novos com FLOW_TEMPLATES_DATA expandido populam
 * automaticamente os templates novos. Sem migration, sem endpoint
 * manual, sem precisar DATABASE_URL local.
 */

import { prisma, FLOW_TEMPLATES_DATA } from '@zappiq/database';
import { logger } from '../utils/logger';

export async function bootstrapFlowTemplatesIfEmpty(): Promise<void> {
  try {
    const existing = (await prisma.flowTemplate.findMany({
      select: { vertical: true, category: true, name: true },
    })) as Array<{ vertical: string; category: string; name: string }>;

    const existingKeys = new Set(existing.map((t) => `${t.vertical}|${t.category}|${t.name}`));

    const missing = FLOW_TEMPLATES_DATA.filter((t) => {
      const key = `${t.vertical}|${t.category}|${t.name}`;
      return !existingKeys.has(key);
    });

    if (missing.length === 0) {
      logger.info(`[bootstrap:flowTemplates] todos os ${FLOW_TEMPLATES_DATA.length} templates ja presentes, skip`);
      return;
    }

    logger.info(`[bootstrap:flowTemplates] inserindo ${missing.length} templates faltantes (DB tem ${existing.length}, codigo tem ${FLOW_TEMPLATES_DATA.length})...`);

    let inserted = 0;
    for (const tpl of missing) {
      try {
        await prisma.flowTemplate.create({ data: tpl as any });
        inserted++;
      } catch (err: any) {
        logger.warn(`[bootstrap:flowTemplates] falhou ao inserir ${tpl.name}: ${err?.message}`);
      }
    }

    logger.info(`[bootstrap:flowTemplates] OK — ${inserted}/${missing.length} templates inseridos (total agora: ${existing.length + inserted})`);
  } catch (err: any) {
    logger.error(`[bootstrap:flowTemplates] FAIL: ${err?.message ?? err}`);
  }
}
