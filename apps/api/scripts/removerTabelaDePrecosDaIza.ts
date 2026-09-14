/**
 * Tira o preço congelado do prompt da Iza (achado A229).
 *
 * O `agents.system_prompt` da org da ZappIQ foi editado à mão em 16/06/2026 e
 * ficou com a tabela de planos do Pricing V3 (Scale a R$ 997, Starter e
 * Business já descontinuados). A seção PRICING agora é gerada do catálogo em
 * runtime pelo izaFactsService; este script limpa o que está gravado.
 *
 * A lógica está testada em src/agents/izaPrecoRemediation.test.ts (14 testes).
 * Aqui é só o CLI. A MESMA função pura serve os dois modos, então o que o
 * teste provou é o que vai para produção.
 *
 * Seguro por construção:
 *   - DRY-RUN é o padrão. Sem --apply não escreve nada.
 *   - Só mexe no agente da org da ZappIQ (ZAPPIQ_ORG_ID), nunca em cliente.
 *   - Recusa gravar se o resultado perder o marcador de identidade, ficar com
 *     menos de 60% do tamanho ou ainda tiver valor em reais.
 *   - Grava por publishPrompt com source 'migracao', então o gatilho do
 *     Postgres cria a versão em agent_prompt_versions.
 *   - Idempotente: rodar de novo não muda nada.
 *
 * Uso (DATABASE_URL vem do AMBIENTE, nunca como argumento):
 *
 *   # (a) modo com banco, só olhando
 *   npx tsx scripts/removerTabelaDePrecosDaIza.ts --dry-run
 *
 *   # (a) modo com banco, gravando por publishPrompt
 *   npx tsx scripts/removerTabelaDePrecosDaIza.ts --apply
 *
 *   # (b) modo OFFLINE, sem banco: transforma um arquivo de texto
 *   npx tsx scripts/removerTabelaDePrecosDaIza.ts --in prompt.txt --out limpo.txt
 *
 * O modo offline existe para o caminho de produção sem expor credencial: o
 * prompt é exportado por SQL, transformado aqui e gravado de volta por SQL com
 * set_config('zappiq.prompt_source','migracao'). O roteiro está no corpo do PR.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { PLAN_IDS, PLAN_CONFIG } from '@zappiq/shared';
import {
  removerTabelaDePrecos,
  validarPromptResultante,
  avisosDeNumeroSolto,
} from '../src/agents/izaPrecoRemediation.js';

/*
 * O modo offline roda SEM banco e SEM variável de ambiente. Por isso nada
 * que dependa de `config/env` (prisma, logger, promptVersionService) entra
 * por import de topo: esses módulos são carregados só dentro do modo com
 * banco, por import dinâmico.
 */

/** md5 do texto: exatamente o que `md5(system_prompt)` do Postgres grava. */
function md5(texto: string): string {
  return createHash('md5').update(texto ?? '', 'utf8').digest('hex');
}

/** Mostra só o host: a senha do banco nunca vai para a tela nem para o log. */
function mascararHost(url?: string): string {
  if (!url) return '(não definida)';
  const m = url.match(/@([^:/?]+)/);
  return m ? m[1] : '(host não identificado)';
}

/** Todo preço de plano do catálogo, para caçar número solto no dry-run. */
function precosDoCatalogo(): number[] {
  return PLAN_IDS.map((id) => PLAN_CONFIG[id].priceMonthly).filter(
    (v): v is number => typeof v === 'number',
  );
}

function imprimirDiff(antes: string, depois: string, linhas: string[], valores: string[]): void {
  console.log(`\n== Diff ==`);
  console.log(`  tamanho: ${antes.length} → ${depois.length} caracteres`);
  if (linhas.length === 0 && valores.length === 0) {
    console.log('  (nada a mudar: o prompt já está sem preço congelado)');
    return;
  }
  for (const l of linhas) {
    console.log(`  - sai a tabela: ${l.slice(0, 160)}${l.length > 160 ? '…' : ''}`);
  }
  for (const v of valores) {
    console.log(`  - sai o valor: ${v}`);
  }
  for (const aviso of avisosDeNumeroSolto(depois, precosDoCatalogo())) {
    console.log(`  ⚠️  ${aviso}`);
  }
}

/** Modo (b): sem banco. Lê um arquivo, transforma, grava outro. */
function modoOffline(entrada: string, saida: string): void {
  const antes = readFileSync(entrada, 'utf8');
  const r = removerTabelaDePrecos(antes);

  console.log(`\n== OFFLINE (sem banco) ==`);
  console.log(`  entrada: ${entrada}`);
  imprimirDiff(antes, r.prompt, r.linhasDePlanoRemovidas, r.valoresEmReaisSubstituidos);

  const v = validarPromptResultante(antes, r.prompt);
  if (!v.ok) {
    console.error('\n❌ Recusado. Nada foi escrito:');
    for (const m of v.motivos) console.error(`   - ${m}`);
    process.exitCode = 1;
    return;
  }

  writeFileSync(saida, r.prompt, 'utf8');
  console.log(`\n✅ Prompt limpo escrito em: ${saida}`);
  console.log(`   md5 do resultado: ${md5(r.prompt)}`);
  console.log('   Grave em produção pelo SQL do PR, com set_config e dollar-quoting.');
}

/** Modo (a): lê o agente da org da ZappIQ e, com --apply, publica a versão. */
async function modoBanco(apply: boolean): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL não está no ambiente. Use o modo --in/--out ou rode pelo .command.');
    process.exitCode = 1;
    return;
  }
  console.log(`\nBanco: ${mascararHost(process.env.DATABASE_URL)}`);
  console.log(apply ? 'Modo: APLICAR (vai escrever)\n' : 'Modo: DRY-RUN (não escreve nada)\n');

  const { prisma } = await import('@zappiq/database');
  const { ZAPPIQ_ORG_ID } = await import('../src/config/zappiqOrg.js');
  const { publishPrompt } = await import('../src/services/promptVersionService.js');

  const agentes = await prisma.agent.findMany({
    where: { organizationId: ZAPPIQ_ORG_ID },
    select: { id: true, name: true, systemPrompt: true },
  });

  if (agentes.length === 0) {
    console.log('Nenhum agente na org da ZappIQ. Nada a fazer.');
    return;
  }

  for (const a of agentes) {
    const antes = a.systemPrompt ?? '';
    console.log(`\nAgente "${a.name}" (${a.id})`);
    const r = removerTabelaDePrecos(antes);
    imprimirDiff(antes, r.prompt, r.linhasDePlanoRemovidas, r.valoresEmReaisSubstituidos);

    if (!r.mudou) {
      console.log('  ✅ Já está limpo.');
      continue;
    }

    const v = validarPromptResultante(antes, r.prompt);
    if (!v.ok) {
      console.log('  ❌ Recusado, nada gravado:');
      for (const m of v.motivos) console.log(`     - ${m}`);
      process.exitCode = 1;
      continue;
    }

    if (!apply) {
      console.log('  (dry-run: nada foi gravado. Use --apply para publicar a versão.)');
      continue;
    }

    const out = await publishPrompt({
      agentId: a.id,
      systemPrompt: r.prompt,
      source: 'migracao',
      actor: 'removerTabelaDePrecosDaIza',
      expectedHash: md5(antes),
    });
    console.log(`  ✅ Publicado. Versão ${out.version}, hash ${out.hash}.`);
  }

  await prisma.$disconnect();
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const iIn = args.indexOf('--in');
  const iOut = args.indexOf('--out');

  if (iIn !== -1 || iOut !== -1) {
    const entrada = args[iIn + 1];
    const saida = args[iOut + 1];
    if (!entrada || !saida) {
      console.error('❌ O modo offline precisa de --in <arquivo.txt> e --out <arquivo.txt>.');
      process.exitCode = 1;
      return;
    }
    modoOffline(entrada, saida);
    return;
  }

  await modoBanco(args.includes('--apply'));
}

main().catch((err) => {
  console.error('\n❌ Falhou:', err?.message ?? err);
  process.exitCode = 1;
});
