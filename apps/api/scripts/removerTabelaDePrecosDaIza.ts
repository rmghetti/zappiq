/**
 * Tira o preço MORTO do prompt da Iza (achado A229).
 *
 * O `agents.system_prompt` da org da ZappIQ foi editado à mão em 16/06/2026 e
 * ficou com a tabela de planos do Pricing V3 (Scale a R$ 997, Starter e
 * Business já descontinuados). A seção PRICING agora é gerada do catálogo em
 * runtime pelo izaFactsService; este script limpa o que está gravado.
 *
 * A lógica está testada em src/agents/izaPrecoRemediation.test.ts. Aqui é só o
 * CLI. A MESMA função pura serve os dois modos, então o que o teste provou é o
 * que vai para produção.
 *
 * Seguro por construção:
 *   - DRY-RUN é o padrão. Sem --apply não escreve nada.
 *   - Só mexe no agente da org da ZappIQ (ZAPPIQ_ORG_ID), nunca em cliente.
 *   - Preço VIGENTE do catálogo fica onde está (as seis faixas de voz e os
 *     overages por minuto, por exemplo). Só vira ponteiro o valor que o
 *     catálogo não diz mais, e preço de plano descontinuado é sempre morto.
 *   - Recusa gravar se o resultado perder o marcador de identidade, ficar com
 *     menos de 60% do tamanho, sobrar valor em reais MORTO, ou sobrar número
 *     de 3 ou 4 dígitos perto de um nome de plano ("Scale 997", "997,00",
 *     "997/mês"), que é o preço velho escrito sem cifrão. Cota do catálogo
 *     ("Scale 80.000 mensagens", "4.000 minutos") e preço vigente passam.
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
 * ══════════════════════════════════════════════════════════════════════════
 * ROTEIRO DE APLICAÇÃO EM PRODUÇÃO (é ESTE que vale, não o do corpo do PR
 * #367, que citava uma coluna `actor` que não existe e a grafia "updatedAt").
 *
 * O caminho não põe credencial de banco na máquina de ninguém: o prompt sai
 * por SELECT, é transformado offline e volta por UPDATE.
 *
 * PASSO 1: exportar o prompt e guardar o hash
 *
 *   SELECT id, name, length(system_prompt) AS chars, md5(system_prompt) AS hash,
 *          system_prompt
 *     FROM agents
 *    WHERE organization_id = '<ZAPPIQ_ORG_ID>';
 *
 *   Salve o `system_prompt` em ~/Desktop/iza-prompt-antes.txt. O `hash` prova
 *   que ninguém gravou por cima no meio do caminho.
 *
 * PASSO 2: transformar offline (sem banco, sem variável de ambiente)
 *
 *   cd ~/dev/zappiq/apps/api
 *   npx tsx scripts/removerTabelaDePrecosDaIza.ts \
 *     --in  ~/Desktop/iza-prompt-antes.txt \
 *     --out ~/Desktop/iza-prompt-depois.txt
 *
 *   O script imprime o que SAIU e o que FICOU, recusa escrever se a validação
 *   reprovar e mostra o md5 do resultado.
 *
 * PASSO 3: gravar e PROVAR antes do COMMIT
 *
 *   O `set_config` declara a origem para o gatilho `agents_versiona_prompt`
 *   (senão a escrita entra como 'fora_do_app'). `zappiq.prompt_actor` é o que
 *   vai parar na coluna `created_by` de agent_prompt_versions. O dollar-quoting
 *   $prompt$...$prompt$ é obrigatório: o prompt tem aspas simples, aspas duplas
 *   e barras invertidas. A coluna de data chama-se `updated_at` (snake_case):
 *   o `@updatedAt` do Prisma é do aplicativo e não roda em SQL cru, então quem
 *   carimba a data aqui é o UPDATE.
 *
 *     BEGIN;
 *     SELECT set_config('zappiq.prompt_source', 'migracao', true);
 *     SELECT set_config('zappiq.prompt_actor', 'removerTabelaDePrecosDaIza', true);
 *
 *     UPDATE agents
 *        SET system_prompt = $prompt$<conteúdo de iza-prompt-depois.txt>$prompt$,
 *            updated_at = now()
 *      WHERE organization_id = '<ZAPPIQ_ORG_ID>'
 *        AND md5(system_prompt) = '<hash do passo 1>';
 *     -- 0 linhas = alguém gravou no meio do caminho: ROLLBACK e refaça do passo 1.
 *
 *     -- PROVA, ainda dentro da transação. Tem de devolver 0.
 *     SELECT count(*) AS sobrou_preco_velho
 *       FROM agents
 *      WHERE organization_id = '<ZAPPIQ_ORG_ID>'
 *        AND system_prompt LIKE '%997%';
 *     -- diferente de 0 -> ROLLBACK; e volte ao passo 2.
 *     -- igual a 0      -> COMMIT;
 *     COMMIT;
 *
 * PASSO 4: conferir a versão criada (depois do COMMIT)
 *
 *   A coluna do ator chama-se `created_by`; NÃO existe coluna `actor` em
 *   agent_prompt_versions.
 *
 *     SELECT version, source, created_by, hash, created_at
 *       FROM agent_prompt_versions
 *      WHERE agent_id = '<id do passo 1>'
 *      ORDER BY version DESC
 *      LIMIT 3;
 *
 * Alternativa com banco, quando houver DATABASE_URL no ambiente: `--dry-run` e
 * depois `--apply`, que grava por publishPrompt(..., source: 'migracao') com
 * expectedHash.
 * ══════════════════════════════════════════════════════════════════════════
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

/** Agrupa repetição para o diff não virar uma parede de linhas iguais. */
function contar(valores: string[]): [string, number][] {
  const mapa = new Map<string, number>();
  for (const v of valores) mapa.set(v, (mapa.get(v) ?? 0) + 1);
  return [...mapa.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function imprimirDiff(
  antes: string,
  depois: string,
  linhas: string[],
  valores: string[],
  preservados: string[] = [],
): void {
  console.log(`\n== Diff ==`);
  console.log(`  tamanho: ${antes.length} → ${depois.length} caracteres`);
  if (linhas.length === 0 && valores.length === 0) {
    console.log('  (nada a mudar: o prompt já está sem preço morto)');
  }
  for (const l of linhas) {
    console.log(`  - sai a tabela: ${l.slice(0, 160)}${l.length > 160 ? '…' : ''}`);
  }
  for (const v of valores) {
    console.log(`  - sai o valor MORTO: ${v}`);
  }
  // O que FICA é tão importante quanto o que sai: foi preservar as faixas de
  // voz que devolveu à Iza a capacidade de cotar Voice 400 a 4000.
  for (const [valor, vezes] of contar(preservados)) {
    console.log(`  = fica o valor VIGENTE: ${valor}${vezes > 1 ? ` (${vezes}x)` : ''}`);
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
  imprimirDiff(
    antes,
    r.prompt,
    r.linhasDePlanoRemovidas,
    r.valoresEmReaisSubstituidos,
    r.valoresEmReaisPreservados,
  );

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
    imprimirDiff(
      antes,
      r.prompt,
      r.linhasDePlanoRemovidas,
      r.valoresEmReaisSubstituidos,
      r.valoresEmReaisPreservados,
    );

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
