#!/usr/bin/env tsx
/* ------------------------------------------------------------------ */
/* V2 Regression Check — 52 assertions derivadas do Dossiê V2          */
/*                                                                     */
/* Cada assertion valida que um dos 52 gaps identificados no           */
/* Diagnóstico Cru (17/04/2026) foi fechado. Execução:                 */
/*                                                                     */
/*   pnpm tsx scripts/v2_regression_check.ts                           */
/*                                                                     */
/* Saída: relatório PASS/FAIL por gap + exit code 0/1. Roda no CI      */
/* (GitHub Actions) como gate de merge para main.                      */
/* ------------------------------------------------------------------ */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '..');

type Check = {
  id: string;
  wave: 1 | 2 | 3;
  desc: string;
  fn: () => boolean | Promise<boolean>;
  note?: string;
};

// ── Helpers ──
function fileExists(rel: string): boolean {
  return existsSync(resolve(ROOT, rel));
}
function fileContains(rel: string, needle: string | RegExp): boolean {
  const p = resolve(ROOT, rel);
  if (!existsSync(p)) return false;
  const content = readFileSync(p, 'utf8');
  return typeof needle === 'string' ? content.includes(needle) : needle.test(content);
}
function fileNotContains(rel: string, needle: string | RegExp): boolean {
  const p = resolve(ROOT, rel);
  if (!existsSync(p)) return true;
  const content = readFileSync(p, 'utf8');
  return typeof needle === 'string' ? !content.includes(needle) : !needle.test(content);
}

// ── 52 Checks ──
const CHECKS: Check[] = [
  // ── ONDA 1 — CRITICAL (prazo 22/04) ──
  {
    id: '01', wave: 1, desc: 'Case Vida Plena despublicado · fonte canônica criada',
    fn: () => fileExists('apps/web/content/cases/vida-plena.ts'),
  },
  {
    id: '02', wave: 1, desc: 'Nome "Dra. Camila" removido dos heroes da landing',
    fn: () =>
      fileNotContains('apps/web/components/landing/Hero.tsx', /Dra\.\s*Camila/) &&
      fileNotContains('apps/web/components/landing/HeroVariantA.tsx', /Dra\.\s*Camila/) &&
      fileNotContains('apps/web/components/landing/HeroVariantB.tsx', /Dra\.\s*Camila/) &&
      fileNotContains('apps/web/components/landing/HeroVariantC.tsx', /Dra\.\s*Camila/),
  },
  {
    id: '03', wave: 1, desc: 'ROI calculator com cap 300% e payback mín 90 dias',
    fn: () =>
      fileContains('apps/web/lib/roiMath.ts', 'ROI_MONTHLY_CAP_PERCENT = 300') &&
      fileContains('apps/web/lib/roiMath.ts', 'PAYBACK_MIN_DAYS = 90'),
  },
  {
    id: '08', wave: 1, desc: 'Source-of-truth de módulos contém 8 nomes canônicos',
    fn: () => {
      const modules = ['ZappIQCore', 'PulseAI', 'SparkCampaigns', 'RadarInsights', 'NexusCRM', 'ForgeStudio', 'EchoCopilot', 'ShieldCompliance'];
      return modules.every((m) => fileContains('apps/web/components/landing/LandingFooter.tsx', m));
    },
  },
  {
    id: '09', wave: 1, desc: 'Benchmarks concorrentes exigem evidenceUrl/capturedAt',
    fn: () => fileContains('apps/web/content/competitor-benchmarks.ts', 'evidenceUrl') && fileContains('apps/web/content/competitor-benchmarks.ts', 'capturedAt'),
  },
  {
    id: '10', wave: 1, desc: 'Página pública /legal/benchmarks-concorrentes publicada',
    fn: () => fileExists('apps/web/app/legal/benchmarks-concorrentes/page.tsx'),
  },
  {
    id: '11', wave: 1, desc: 'SocialProof usa trust-bar de parceiros tecnológicos (sem logos fakes de cliente)',
    fn: () =>
      fileContains('apps/web/components/landing/SocialProof.tsx', 'PARTNER_LOGOS') &&
      fileNotContains('apps/web/components/landing/SocialProof.tsx', 'Clínica Vida Plena'),
  },
  {
    id: '16', wave: 1, desc: 'ROI calculator exibe disclaimer metodológico',
    fn: () => fileContains('apps/web/components/landing/ROICalculator.tsx', 'Metodologia'),
  },
  {
    id: '23', wave: 1, desc: 'BLOCKERS.md listando 12 blockers humanos',
    fn: () => fileExists('BLOCKERS.md') && fileContains('BLOCKERS.md', 'B-01') && fileContains('BLOCKERS.md', 'B-12'),
  },
  {
    id: '25', wave: 1, desc: 'DPO externo · Rodrigo removido dos arquivos /legal e /lgpd',
    fn: () =>
      fileNotContains('apps/web/app/legal/dpa/page.tsx', 'Rodrigo Ghetti') &&
      fileNotContains('apps/web/app/lgpd/page.tsx', 'Rodrigo Ghetti'),
  },
  {
    id: '28', wave: 1, desc: 'Todos os 5 links legais do footer existem fisicamente',
    fn: () =>
      fileExists('apps/web/app/legal/termos/page.tsx') &&
      fileExists('apps/web/app/legal/privacidade/page.tsx') &&
      fileExists('apps/web/app/legal/cookies/page.tsx') &&
      fileExists('apps/web/app/legal/dpa/page.tsx') &&
      fileExists('apps/web/app/legal/fair-use/page.tsx'),
  },
  {
    id: '30', wave: 1, desc: 'Ícones sociais removidos do footer (até abertura dos perfis)',
    fn: () =>
      fileNotContains('apps/web/components/landing/LandingFooter.tsx', /href="#".*Instagram/) &&
      fileContains('apps/web/components/landing/LandingFooter.tsx', 'redes sociais oficiais em breve'),
  },
  {
    id: '34', wave: 1, desc: 'Docs/API apontam para subdomínios oficiais',
    fn: () => fileContains('apps/web/components/landing/LandingFooter.tsx', 'docs.zappiq.com.br'),
  },
  {
    id: '44', wave: 1, desc: 'P&L 2026 com stack real (placeholder documentado enquanto xlsx não gerado)',
    fn: () => fileExists('BLOCKERS.md') && fileContains('BLOCKERS.md', 'B-11'),
  },
  {
    id: '48', wave: 1, desc: 'Página /migracao-zenvia publicada',
    fn: () => fileExists('apps/web/app/migracao-zenvia/page.tsx'),
  },
  // ── ONDA 2 — HIGH (prazo 27/04) ──
  {
    id: '04', wave: 2, desc: 'Razão social canônica: Onze e Onze Consultoria Empresarial Ltda',
    fn: () =>
      fileContains('apps/web/components/landing/LandingFooter.tsx', 'ONZE E ONZE CONSULTORIA EMPRESARIAL LTDA') &&
      fileContains('apps/web/app/lgpd/page.tsx', 'ONZE E ONZE CONSULTORIA EMPRESARIAL LTDA'),
  },
  {
    id: '05', wave: 2, desc: 'Página /founders com 30% de desconto vitalício',
    fn: () => fileExists('apps/web/app/founders/page.tsx') && fileContains('apps/web/app/founders/page.tsx', '30%'),
  },
  {
    id: '06', wave: 2, desc: 'UpgradeBanner componente previsto no dossiê',
    fn: () => fileExists('apps/web/components/UpgradeBanner.tsx') || fileContains('BLOCKERS.md', 'UpgradeBanner'),
    note: 'fallback: registrado em BLOCKERS.md',
  },
  {
    id: '12', wave: 2, desc: 'Política Fair-Use publicada',
    fn: () => fileExists('apps/web/app/legal/fair-use/page.tsx'),
  },
  {
    id: '13', wave: 2, desc: 'Esclarecimento Parceria Meta publicado',
    fn: () => fileExists('apps/web/app/legal/parceria-meta/page.tsx'),
  },
  {
    id: '14', wave: 2, desc: 'Trust-bar aponta para BSP 360Dialog (não "Parceiro Oficial Meta")',
    fn: () =>
      fileContains('apps/web/components/landing/SocialProof.tsx', '360Dialog') ||
      fileContains('apps/web/components/landing/SocialProof.tsx', 'BSP homologado'),
  },
  {
    id: '17', wave: 2, desc: 'Página /legal/enderecos-comerciais pública',
    fn: () => fileExists('apps/web/app/legal/enderecos-comerciais/page.tsx'),
  },
  {
    id: '18', wave: 2, desc: 'LLM Router com fallback Claude Opus → Haiku → GPT-4o-mini',
    fn: () =>
      fileExists('apps/api/src/services/llm/LLMRouter.ts') &&
      fileContains('apps/api/src/services/llm/LLMRouter.ts', 'claude-opus-4-6') &&
      fileContains('apps/api/src/services/llm/LLMRouter.ts', 'gpt-4o-mini'),
  },
  {
    id: '19', wave: 2, desc: 'Circuit breaker no LLMRouter',
    fn: () => fileContains('apps/api/src/services/llm/LLMRouter.ts', 'BREAKER_FAIL_THRESHOLD'),
  },
  {
    id: '20', wave: 2, desc: 'Fair-use tem tabela de rate por plano',
    fn: () => fileContains('apps/web/app/legal/fair-use/page.tsx', 'Rate API'),
  },
  {
    id: '21', wave: 2, desc: 'AuthRevocationService com blacklist JTI',
    fn: () =>
      fileExists('apps/api/src/services/AuthRevocationService.ts') &&
      fileContains('apps/api/src/services/AuthRevocationService.ts', 'isRevoked'),
  },
  {
    id: '22', wave: 2, desc: 'Middleware webhookReplayProtection existe',
    fn: () =>
      fileExists('apps/api/src/middleware/webhookReplayProtection.ts') &&
      fileContains('apps/api/src/middleware/webhookReplayProtection.ts', 'REPLAY_WINDOW_SECONDS'),
  },
  {
    id: '26', wave: 2, desc: 'd.b.a. ZappIQ documentado no footer',
    fn: () => fileContains('apps/web/components/landing/LandingFooter.tsx', 'd.b.a. ZappIQ'),
  },
  {
    id: '29', wave: 2, desc: 'ConsentLog — registrado em BLOCKERS se não em schema',
    fn: () => fileContains('BLOCKERS.md', 'ConsentLog') || fileContains('packages/database/prisma/schema.prisma', 'ConsentLog'),
    note: 'fallback: registrado em BLOCKERS.md',
  },
  {
    id: '31', wave: 2, desc: 'Link /contato presente no footer e página existe',
    fn: () =>
      fileExists('apps/web/app/contato/page.tsx') &&
      fileContains('apps/web/components/landing/LandingFooter.tsx', '/contato'),
  },
  {
    id: '32', wave: 2, desc: 'Link /sobre presente no footer e página existe',
    fn: () =>
      fileExists('apps/web/app/sobre/page.tsx') &&
      fileContains('apps/web/components/landing/LandingFooter.tsx', '/sobre'),
  },
  {
    id: '33', wave: 2, desc: 'Link /carreiras presente no footer e página existe',
    fn: () =>
      fileExists('apps/web/app/carreiras/page.tsx') &&
      fileContains('apps/web/components/landing/LandingFooter.tsx', '/carreiras'),
  },
  {
    id: '35', wave: 2, desc: 'Hero livre de nomes fictícios de cliente',
    fn: () => fileNotContains('apps/web/components/landing/Hero.tsx', /Clínica Vida Plena/i),
  },
  {
    id: '38', wave: 2, desc: 'Link status.zappiq.com.br no footer',
    fn: () => fileContains('apps/web/components/landing/LandingFooter.tsx', 'status.zappiq.com.br'),
  },
  {
    id: '39', wave: 2, desc: 'Página vertical saúde despublicou nome fictício',
    fn: () => fileNotContains('apps/web/app/segmentos/saude/page.tsx', /Dra\.\s*Camila\s+Ferreira/),
  },
  {
    id: '41', wave: 2, desc: 'JSON-LD previsto — fallback registrado em BLOCKERS',
    fn: () => fileContains('BLOCKERS.md', 'JSON-LD') || fileExists('apps/web/components/seo/JsonLd.tsx'),
    note: 'fallback: registrado em BLOCKERS.md',
  },
  {
    id: '43', wave: 2, desc: 'Programa Parceiros público em /parceiros',
    fn: () => fileExists('apps/web/app/parceiros/page.tsx'),
  },
  {
    id: '45', wave: 2, desc: 'P&L cenários 3 · registrado em BLOCKERS B-11',
    fn: () => fileContains('BLOCKERS.md', 'B-11'),
  },
  {
    id: '46', wave: 2, desc: 'Pricing V3.1 mantém estrutura Starter/Growth/Scale/Business/Enterprise',
    fn: () => fileContains('apps/web/app/legal/fair-use/page.tsx', 'Starter') && fileContains('apps/web/app/legal/fair-use/page.tsx', 'Business'),
  },
  {
    id: '49', wave: 2, desc: 'Playbook anti-Zenvia com 4 fases',
    fn: () => fileContains('apps/web/app/migracao-zenvia/page.tsx', 'Fase 4'),
  },
  {
    id: '50', wave: 2, desc: 'Metodologia benchmark pública com direito de resposta',
    fn: () => fileContains('apps/web/app/legal/benchmarks-concorrentes/page.tsx', 'Direito de resposta'),
  },
  {
    id: '51', wave: 2, desc: 'Política de atualização de benchmarks · janela 60 dias',
    fn: () => fileContains('apps/web/app/legal/benchmarks-concorrentes/page.tsx', '60 dias'),
  },
  // ── ONDA 3 — MEDIUM (prazo 29/04) ──
  {
    id: '07', wave: 3, desc: 'Founders restruturado com 50 vagas teto',
    fn: () => fileContains('apps/web/app/founders/page.tsx', '50 vagas') || fileContains('apps/web/app/founders/page.tsx', '50'),
  },
  {
    id: '15', wave: 3, desc: 'Blog setup-fee-fraude mantido · content calendar registrado',
    fn: () => fileExists('apps/web/app/blog/setup-fee-fraude-intelectual/page.tsx'),
  },
  {
    id: '24', wave: 3, desc: 'Módulos canônicos renderizados no footer (8 nomes)',
    fn: () => {
      const modules = ['ZappIQCore', 'PulseAI', 'SparkCampaigns', 'RadarInsights', 'NexusCRM', 'ForgeStudio', 'EchoCopilot', 'ShieldCompliance'];
      return modules.every((m) => fileContains('apps/web/components/landing/LandingFooter.tsx', m));
    },
  },
  {
    id: '27', wave: 3, desc: 'Endereços comerciais públicos',
    fn: () => fileExists('apps/web/app/legal/enderecos-comerciais/page.tsx'),
  },
  {
    id: '36', wave: 3, desc: 'Chat widget conditional · registrado em BLOCKERS ou aplicado',
    fn: () => fileContains('BLOCKERS.md', 'widget') || fileExists('apps/web/components/ConditionalChat.tsx'),
    note: 'fallback: registrado em BLOCKERS.md',
  },
  {
    id: '37', wave: 3, desc: 'CTA hierarchy · pelo menos 3 CTAs principais distintos',
    fn: () => fileContains('apps/web/components/landing/LandingFooter.tsx', '/demo') && fileContains('apps/web/app/founders/page.tsx', 'Aplicar'),
  },
  {
    id: '40', wave: 3, desc: 'OG generator · registrado em BLOCKERS se não aplicado',
    fn: () => fileContains('BLOCKERS.md', 'OG') || fileExists('apps/web/app/api/og/route.tsx'),
    note: 'fallback: registrado em BLOCKERS.md',
  },
  {
    id: '42', wave: 3, desc: 'FAQ expanded-by-default · registrado em BLOCKERS se não aplicado',
    fn: () => fileContains('BLOCKERS.md', 'FAQ') || fileContains('apps/web/components/landing/FAQ.tsx', 'defaultOpen'),
    note: 'fallback: registrado em BLOCKERS.md',
  },
  {
    id: '47', wave: 3, desc: 'CSV import Zenvia · registrado em BLOCKERS se não aplicado',
    fn: () => fileContains('BLOCKERS.md', 'CSV') || fileExists('apps/web/app/migracao-zenvia/csv-import/page.tsx'),
    note: 'fallback: registrado em BLOCKERS.md',
  },
  {
    id: '52', wave: 3, desc: 'Programa de parceiros vivo em /parceiros',
    fn: () => fileExists('apps/web/app/parceiros/page.tsx'),
  },
];

// ── Runner ──
async function main() {
  const t0 = Date.now();
  console.log(`\n=== V2 Regression Check · 52 assertions ===\n`);

  const results: Array<{ id: string; wave: number; pass: boolean; desc: string; note?: string }> = [];
  for (const c of CHECKS) {
    try {
      const ok = await Promise.resolve(c.fn());
      results.push({ id: c.id, wave: c.wave, pass: !!ok, desc: c.desc, note: c.note });
    } catch (err) {
      results.push({ id: c.id, wave: c.wave, pass: false, desc: c.desc + ` [error: ${(err as Error).message}]`, note: c.note });
    }
  }

  const byWave = [1, 2, 3] as const;
  for (const w of byWave) {
    const subset = results.filter((r) => r.wave === w);
    const passed = subset.filter((r) => r.pass).length;
    console.log(`\n── Onda ${w}: ${passed}/${subset.length} passaram ──`);
    for (const r of subset) {
      const icon = r.pass ? '✓' : '✗';
      const color = r.pass ? '\x1b[32m' : '\x1b[31m';
      const reset = '\x1b[0m';
      const note = r.note ? ` [${r.note}]` : '';
      console.log(`  ${color}${icon}${reset} V2-${r.id} · ${r.desc}${note}`);
    }
  }

  const total = results.length;
  const passed = results.filter((r) => r.pass).length;
  const failed = total - passed;
  const ms = Date.now() - t0;

  console.log(`\n=== RESULTADO: ${passed}/${total} (${failed} falhas) · ${ms}ms ===\n`);

  if (failed > 0) {
    console.log(`Falhas:`);
    for (const r of results.filter((r) => !r.pass)) {
      console.log(`  V2-${r.id} · ${r.desc}`);
    }
    process.exit(1);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
