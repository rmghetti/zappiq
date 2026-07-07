/* ══════════════════════════════════════════════════════════════════════
 * backfillSurveyIngest (CLI) — garante que TODA fonte do /ai-training
 * alimenta o RAG, para orgs antigas:
 *
 *  1. Survey/qualificação: orgs com settings.surveyAnswers preenchido mas
 *     SEM chunks onboarding-survey-* no namespace → ingere agora e grava
 *     settings.surveyDocFilename (usado pelo PUT /survey pra apagar o doc
 *     antigo quando o niche mudar).
 *  2. Documentos por URL: re-ingere com a limpeza de HTML (antes o markup
 *     cru virava milhares de chunks-lixo; replace-on-ingest substitui).
 *
 * Uso: (dry) BACKFILL_DRY_RUN=1 pnpm --filter @zappiq/api exec tsx scripts/backfillSurveyIngest.ts
 *      (real) pnpm --filter @zappiq/api exec tsx scripts/backfillSurveyIngest.ts
 * Requer env: DATABASE_URL (prod), RAG_SERVICE_URL, RAG_SERVICE_SECRET.
 * ══════════════════════════════════════════════════════════════════════ */

import { prisma } from '@zappiq/database';
import { ingestDocument, ingestUrl } from '../src/services/ragService.js';
import { buildKnowledgeBase, surveyDocFilename, countAnsweredQuestions } from '../src/services/knowledgeBaseBuilder.js';

const DRY = process.env.BACKFILL_DRY_RUN === '1';

async function main() {
  console.log(`[backfillSurveyIngest] início${DRY ? ' (DRY RUN)' : ''}`);

  // ── 1. Surveys sem chunks ────────────────────────────────────────────
  const orgs = (await prisma.$queryRawUnsafe(`
    SELECT o.id, o.name, o.settings
      FROM organizations o
     WHERE o.settings ? 'surveyAnswers'
       AND NOT EXISTS (
         SELECT 1 FROM rag_chunks rc
          WHERE rc.namespace = 'org_' || o.id
            AND rc.source LIKE 'onboarding-survey%'
       )
  `)) as Array<{ id: string; name: string; settings: any }>;

  let surveyOk = 0, surveySkip = 0, surveyFail = 0;
  for (const org of orgs) {
    const settings = org.settings || {};
    const surveyAnswers = settings.surveyAnswers || {};
    if (countAnsweredQuestions(surveyAnswers) === 0) { surveySkip++; continue; }

    const niche = settings.niche || 'geral';
    const filename = surveyDocFilename(niche);
    console.log(`  survey org=${org.id} (${org.name}) niche=${niche} → ${filename}`);
    if (DRY) { surveyOk++; continue; }
    try {
      const kb = buildKnowledgeBase({
        businessName: settings.businessName || org.name || 'Empresa',
        niche,
        surveyAnswers,
      });
      await ingestDocument(org.id, {
        filename,
        content: Buffer.from(kb, 'utf8'),
        mimeType: 'text/plain',
      });
      await prisma.organization.update({
        where: { id: org.id },
        data: { settings: { ...settings, surveyDocFilename: filename } },
      });
      surveyOk++;
    } catch (e: any) {
      surveyFail++;
      console.error(`  survey org=${org.id} FALHOU: ${e?.message}`);
    }
  }

  // ── 2. URL docs: re-ingestão com HTML limpo ──────────────────────────
  const urlDocs = (await prisma.$queryRawUnsafe(`
    SELECT d.id, d."sourceUrl", k."organizationId" AS org
      FROM kb_documents d
      JOIN knowledge_bases k ON k.id = d."knowledgeBaseId"
     WHERE d."sourceType" = 'url' AND d."sourceUrl" IS NOT NULL
  `)) as Array<{ id: string; sourceUrl: string; org: string }>;

  let urlOk = 0, urlFail = 0;
  for (const d of urlDocs) {
    console.log(`  url org=${d.org} → ${d.sourceUrl}`);
    if (DRY) { urlOk++; continue; }
    try {
      const r: any = await ingestUrl(d.org, d.sourceUrl);
      console.log(`    chunks=${r?.chunks_ingested}`);
      urlOk++;
    } catch (e: any) {
      urlFail++;
      console.error(`  url doc=${d.id} FALHOU: ${e?.message}`);
    }
  }

  console.log(
    `[backfillSurveyIngest] concluído — surveys: ok=${surveyOk} sem_respostas=${surveySkip} falhas=${surveyFail}` +
    ` | urls: ok=${urlOk} falhas=${urlFail}`,
  );
}

main()
  .then(async () => { await prisma.$disconnect(); process.exit(0); })
  .catch(async (e) => { console.error('[backfillSurveyIngest] ERRO:', e); await prisma.$disconnect(); process.exit(1); });
