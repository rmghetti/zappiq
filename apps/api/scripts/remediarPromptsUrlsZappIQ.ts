/**
 * Remediação dos prompts já gravados: tira o bloco de URLs da ZappIQ do
 * Agent.systemPrompt dos CLIENTES.
 *
 * Por quê: o promptEngine ganhou "### URLs canônicas ZappIQ" em 12/05/2026 e o
 * buildSeedSystemPrompt (05/07, W1.5) congela a saída dele no Agent de cada org.
 * Todo Agent seedado desde então manda o lead do cliente pro NOSSO cadastro.
 * Corrigir o promptEngine só vale pra seed novo; isto resolve o que já está no
 * banco.
 *
 * Seguro por construção:
 *   - AUDITORIA é o padrão. Sem --apply não escreve nada.
 *   - A org da ZappIQ é pulada: lá os nossos links são legítimos.
 *   - Snapshot em JSON antes de qualquer UPDATE.
 *   - Cirúrgico: troca só a seção de URLs, preserva customização.
 *   - Idempotente. E --revert desfaz.
 *
 * A lógica está testada em src/services/promptRemediationService.test.ts (10
 * testes) e src/agents/promptUrlRemediation.test.ts (9). Aqui é só o CLI.
 *
 * Uso (DATABASE_URL vem do AMBIENTE, nunca como argumento):
 *   npx tsx scripts/remediarPromptsUrlsZappIQ.ts              # auditar
 *   npx tsx scripts/remediarPromptsUrlsZappIQ.ts --apply      # corrigir
 *   npx tsx scripts/remediarPromptsUrlsZappIQ.ts --revert <f> # desfazer
 */
import { writeFileSync, readFileSync } from 'node:fs';
import { prisma } from '@zappiq/database';
import {
  auditarPrompts,
  aplicarRemediacao,
  verificarNoBanco,
  reverterRemediacao,
  type RemediacaoDb,
  type PromptSnapshot,
} from '../src/services/promptRemediationService.js';

const db = prisma as unknown as RemediacaoDb;

/** Mostra só o host: a senha do banco nunca vai pra tela nem pro log. */
function mascararHost(url?: string): string {
  if (!url) return '(não definida)';
  const m = url.match(/@([^:/?]+)/);
  return m ? m[1] : '(host não identificado)';
}

async function main() {
  const args = process.argv.slice(2);
  const APPLY = args.includes('--apply');
  const revertIdx = args.indexOf('--revert');
  const REVERT_FILE = revertIdx !== -1 ? args[revertIdx + 1] : null;

  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL não está no ambiente. Rode pelo .command.');
    process.exit(1);
  }
  console.log(`\nBanco: ${mascararHost(process.env.DATABASE_URL)}`);

  if (REVERT_FILE) {
    const itens: PromptSnapshot[] = JSON.parse(readFileSync(REVERT_FILE, 'utf8'));
    console.log(`\n== REVERT: restaurando ${itens.length} prompt(s) ==`);
    const n = await reverterRemediacao(db, itens);
    console.log(`\n✅ ${n} prompt(s) restaurado(s) exatamente como estavam.`);
    return;
  }

  console.log(APPLY ? 'Modo: APLICAR (vai escrever)\n' : 'Modo: AUDITORIA (não escreve nada)\n');

  const { totalAgents, afetados, izaComBloco } = await auditarPrompts(db);

  console.log(`Agents no banco: ${totalAgents}`);
  console.log(`Org da ZappIQ: ${izaComBloco.length} agent(s) com o bloco — pulados de propósito.`);
  console.log(`Prompts de CLIENTE com link nosso dentro: ${afetados.length}\n`);

  if (afetados.length === 0) {
    console.log('✅ Nenhum prompt de cliente tem o bloco de URLs da ZappIQ.');
    console.log('   Nada a corrigir. (O fix do promptEngine cobre os seeds novos.)');
    return;
  }

  for (const it of afetados) {
    console.log(`  • ${it.orgName} — agente "${it.agentName}"`);
    for (const linha of it.removido.split('\n').filter(Boolean).slice(0, 4)) {
      console.log(`      - sai: ${linha}`);
    }
    console.log(`      prompt: ${it.promptAntes.length} → ${it.promptDepois.length} chars\n`);
  }

  if (!APPLY) {
    console.log('— Nada foi alterado. Para corrigir de verdade, rode a opção 2 do menu. —');
    return;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const snapFile = `${process.env.HOME}/Desktop/zappiq-prompts-snapshot-${stamp}.json`;
  writeFileSync(snapFile, JSON.stringify(afetados, null, 2), 'utf8');
  console.log(`📸 Snapshot (prompts ANTES) salvo em:\n   ${snapFile}\n`);

  const { corrigidos, recusados } = await aplicarRemediacao(db, afetados);
  for (const r of recusados) {
    console.log(`  ⚠️  ${r.orgName}: PULADO, ainda sobrava ${r.termos.join(', ')} depois da limpeza.`);
  }

  console.log('\n== Verificação (releitura do banco) ==');
  const sujos = await verificarNoBanco(db, afetados);
  if (sujos.length === 0) {
    console.log('  ✅ Nenhum prompt de cliente com marca da ZappIQ.');
  } else {
    for (const s of sujos) console.log(`  ❌ ${s.orgName}: ainda tem ${s.termos.join(', ')}`);
  }

  console.log(`\n✅ ${corrigidos}/${afetados.length} prompt(s) corrigido(s).`);
  console.log('\nPara desfazer tudo:');
  console.log(`   cd "${process.cwd()}"`);
  console.log(`   npx tsx scripts/remediarPromptsUrlsZappIQ.ts --revert "${snapFile}"`);
}

main()
  .catch((err) => {
    console.error('\n❌ Falhou:', err?.message ?? err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
