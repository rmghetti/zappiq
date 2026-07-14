/**
 * Teste real da Vera (agente do CMJ) com IA de verdade.
 * ---------------------------------------------------------------------
 * Roda o gabarito NOVO (isolado por tenant) contra o prompt REAL da Vera,
 * usando o LLM de verdade (o mesmo runner de produção), e imprime o score.
 *
 * Prova o conserto do incidente de 14/07: a Vera passa a ser avaliada como
 * "Vera, de CMJ", nao contra a prova comercial da Iza (ZappIQ).
 *
 * NAO toca o banco de producao: o prompt da Vera esta em vera-prompt.txt
 * (lido do banco em 14/07, pos-correcao). So precisa da ANTHROPIC_API_KEY.
 *
 * Uso (via o .command): ANTHROPIC_API_KEY=... npx tsx scripts/testar-vera-eval.ts
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { resolveEvalSet, getSkippedScenarios } from '../src/agents/agentEvalSet.js';
import { executeAgentEvalRun } from '../src/services/agentEvalRunner.js';
import type { TenantAgentProfile } from '../src/agents/tenantAgentProfile.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('\n[ERRO] Falta a ANTHROPIC_API_KEY no ambiente. O .command deveria te pedir.\n');
  process.exit(1);
}

// Prompt real da Vera (do banco de producao, 14/07/2026, ja sem o vazamento da ZappIQ).
const veraPrompt = readFileSync(join(__dirname, 'vera-prompt.txt'), 'utf8');

// Perfil real da Vera (CMJ). isZappIQ=false => recebe o gabarito UNIVERSAL,
// parametrizado pelo negocio dela, nunca os cenarios comerciais da ZappIQ.
const vera: TenantAgentProfile = {
  organizationId: 'cmr4x0zmn007msdhtqn6lfkia',
  isZappIQ: false,
  agentName: 'Vera',
  businessName: 'CMJ',
  niche: 'servicos_b2b',
  tone: 'friendly',
  siteUrl: 'cmj.com.br',
  servicos: null,
  precos: null, // CMJ nao cadastrou tabela de precos: o teste de preco nao roda
  descontoMaximo: null,
  regrasComerciais: null,
  temSiteUrl: true,
  temServicos: false,
  temPrecos: false,
  identityDrift: false,
  systemPrompt: veraPrompt,
  agentId: 'c39b19bb-d730-42be-855a-db2c21ecab94',
};

const linha = '='.repeat(66);
const icon = (c: string) => (c === 'pass' ? '[OK]  ' : c === 'partial' ? '[~]   ' : '[X]   ');

async function main() {
  const scenarios = resolveEvalSet(vera);
  const skipped = getSkippedScenarios(vera);

  console.log(`\n${linha}`);
  console.log(`  TESTE REAL DA VERA (agente do CMJ) — com IA de verdade`);
  console.log(linha);
  console.log(`Agente avaliado : ${vera.agentName}, de ${vera.businessName} (${vera.niche})`);
  console.log(`Cenarios        : ${scenarios.length} (so o que se aplica ao negocio da CMJ)`);
  if (skipped.length) console.log(`Nao rodou       : ${skipped.map((s) => s.reason).join(' | ')}`);
  console.log(`\nRodando com IA de verdade. Leva de 2 a 4 min e faz ~${scenarios.length * 3} chamadas ao modelo.`);
  console.log(`Aguarde...\n`);

  const { results, summary, durationMs } = await executeAgentEvalRun(
    scenarios,
    { id: vera.agentId!, name: vera.agentName, systemPrompt: vera.systemPrompt },
    vera,
  );

  for (const r of results) {
    console.log(`${icon(r.combined)} ${r.scenarioId}`);
    console.log(`      Perguntaram : "${r.userMessage}"`);
    console.log(`      Vera disse  : ${(r.response || '(vazio)').replace(/\s+/g, ' ').slice(0, 140)}`);
    if (r.combined !== 'pass') {
      console.log(`      Veredito    : ${r.judge.reason || '(sem motivo)'}`);
    }
    console.log('');
  }

  console.log(linha);
  console.log(`  SCORE REAL DA VERA: ${summary.scorePercent}%  (${summary.passed} de ${results.length} aprovados)`);
  console.log(`  Parciais: ${summary.partial}  |  Reprovados: ${summary.failed}  |  Criticos reprovados: ${summary.criticalFailed}`);
  console.log(`  Tempo: ${(durationMs / 1000).toFixed(0)}s`);
  console.log(linha);
  console.log(`\n  Para comparar: sob o gabarito ANTIGO (a prova da Iza), a Vera`);
  console.log(`  tirava 52% e era reprovada por dizer que e do CMJ. Agora ela e`);
  console.log(`  avaliada como Vera, do CMJ.\n`);

  process.exit(0);
}

main().catch((e) => {
  console.error('\n[ERRO] O teste falhou:', e?.message || e);
  console.error('Se for erro de chave/credito da Anthropic, confira a chave e o saldo.\n');
  process.exit(1);
});
