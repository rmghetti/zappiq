/**
 * Tira do prompt vivo os "# PATCH MANUAL" e as "REGRA INVIOLÁVEL #N" e
 * transforma cada um em registro na tabela agent_rules (achados A079, A081,
 * A188).
 *
 * A lógica está testada em src/services/patchesParaRegistros.test.ts, contra a
 * fixture do prompt da Marcia (MACHIA): quatro blocos "# PATCH MANUAL", três
 * deles cortados no meio da frase e dois para o mesmo cenário. Aqui é só o
 * CLI. A MESMA função pura serve os dois modos, então o que o teste provou é o
 * que vai para produção.
 *
 * O QUE O SCRIPT FAZ COM CADA BLOCO
 *   • bloco inteiro, cenário novo          -> regra ATIVA
 *   • dois blocos do mesmo cenário         -> o mais recente fica ATIVO,
 *                                             o anterior nasce 'substituida'
 *   • bloco TRUNCADO (para no meio da frase, sem pontuação final)
 *                                          -> NUNCA fica ativo. Nasce
 *                                             'substituida' com motivo
 *                                             'truncada' e vai listado no
 *                                             relatório.
 *   • cenário cujo único bloco era truncado -> termina SEM regra ativa, de
 *                                             propósito: o dono aprovou um
 *                                             texto inteiro e o produto
 *                                             gravou meio. A correção volta a
 *                                             ser oferecida, inteira, na
 *                                             próxima execução.
 *
 * Seguro por construção:
 *   - DRY-RUN é o padrão. Sem --apply não escreve nada.
 *   - Recusa gravar se o prompt resultante perder "## IDENTIDADE", encolher
 *     mais do que os blocos removidos explicam, ou ainda ter bloco de patch.
 *   - Grava o prompt por publishPrompt com source 'migracao', então o gatilho
 *     do Postgres cria a versão em agent_prompt_versions, com expectedHash.
 *   - Idempotente: rodar de novo num prompt já limpo não acha bloco nenhum.
 *
 * Uso (DATABASE_URL vem do AMBIENTE, nunca como argumento):
 *
 *   # (a) modo com banco, só olhando (todos os agentes)
 *   npx tsx scripts/migrarPatchesParaRegistros.ts --dry-run
 *
 *   # (a) um agente só
 *   npx tsx scripts/migrarPatchesParaRegistros.ts --dry-run --agent <id>
 *
 *   # (a) gravando: limpa o prompt por publishPrompt e cria os registros
 *   npx tsx scripts/migrarPatchesParaRegistros.ts --apply --agent <id>
 *
 *   # (b) modo OFFLINE, sem banco: lê um arquivo e escreve o prompt limpo
 *   npx tsx scripts/migrarPatchesParaRegistros.ts --in prompt.txt --out limpo.txt
 *
 * ══════════════════════════════════════════════════════════════════════════
 * ROTEIRO DE APLICAÇÃO EM PRODUÇÃO (sem credencial de banco na máquina de
 * ninguém: o prompt sai por SELECT, é transformado offline e volta por UPDATE)
 *
 * PASSO 1: exportar o prompt e guardar o hash
 *
 *   SELECT id, name, organization_id, length(system_prompt) AS chars,
 *          md5(system_prompt) AS hash, system_prompt
 *     FROM agents
 *    WHERE system_prompt LIKE '%# PATCH MANUAL%'
 *       OR system_prompt LIKE '%REGRA INVIOLÁVEL%';
 *
 *   Salve o system_prompt de cada agente em ~/Desktop/<nome>-antes.txt.
 *
 * PASSO 2: transformar offline (sem banco, sem variável de ambiente)
 *
 *   cd ~/dev/zappiq/apps/api
 *   npx tsx scripts/migrarPatchesParaRegistros.ts \
 *     --in  ~/Desktop/marcia-antes.txt \
 *     --out ~/Desktop/marcia-depois.txt
 *
 *   O script imprime cada bloco encontrado, o status que ele teria
 *   (ativa/substituida) e o motivo, e o INSERT pronto de cada regra. Recusa
 *   escrever se a validação reprovar.
 *
 * PASSO 3: gravar e PROVAR antes do COMMIT
 *
 *   O set_config declara a origem para o gatilho `agents_versiona_prompt`
 *   (senão a escrita entra como 'fora_do_app'). O dollar-quoting
 *   $prompt$...$prompt$ é obrigatório: o prompt tem aspas e barras. A coluna
 *   de data chama-se `updated_at` (snake_case): o @updatedAt do Prisma não
 *   roda em SQL cru.
 *
 *     BEGIN;
 *     SELECT set_config('zappiq.prompt_source', 'migracao', true);
 *     SELECT set_config('zappiq.prompt_actor', 'migrarPatchesParaRegistros', true);
 *
 *     UPDATE agents
 *        SET system_prompt = $prompt$<conteúdo de marcia-depois.txt>$prompt$,
 *            updated_at = now()
 *      WHERE id = '<id do passo 1>'
 *        AND md5(system_prompt) = '<hash do passo 1>';
 *     -- 0 linhas = alguém gravou no meio do caminho: ROLLBACK e refaça do passo 1.
 *
 *     -- As regras, na ordem que o script imprimir (uma linha por bloco):
 *     INSERT INTO agent_rules
 *       (organization_id, agent_id, scenario_id, texto, origem, status, motivo, created_by)
 *     VALUES
 *       ('<org>', '<agent>', 'cr5_nome_disponivel_usar',
 *        $texto$...$texto$, 'manual', 'ativa', NULL, 'migracao');
 *
 *     -- PROVA, ainda dentro da transação. As três têm de dar certo:
 *     SELECT count(*) FROM agents
 *      WHERE id = '<agent>' AND system_prompt LIKE '%# PATCH MANUAL%';   -- 0
 *     SELECT count(*) FROM agents
 *      WHERE id = '<agent>' AND system_prompt LIKE '%## IDENTIDADE%';    -- 1
 *     SELECT scenario_id, count(*) FROM agent_rules
 *      WHERE agent_id = '<agent>' AND status = 'ativa' AND scenario_id IS NOT NULL
 *      GROUP BY 1 HAVING count(*) > 1;                                   -- 0 linhas
 *     -- qualquer divergência -> ROLLBACK;
 *     COMMIT;
 *
 * PASSO 4: conferir a versão criada (depois do COMMIT)
 *
 *     SELECT version, source, created_by, hash, created_at
 *       FROM agent_prompt_versions
 *      WHERE agent_id = '<agent>' ORDER BY version DESC LIMIT 3;
 *
 * PASSO 5: só então ligar o interruptor da organização
 *
 *   O bloco "# Regras aprovadas pelo dono" só entra no prompt com
 *   `regrasComoRegistros` ligado. Ligar ANTES da migração faria o agente
 *   receber a regra duas vezes (no texto colado e no bloco).
 * ══════════════════════════════════════════════════════════════════════════
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import {
  extrairPatches,
  planejarRegistros,
  validarPromptLimpo,
  type RegistroPlanejado,
} from '../src/services/patchesParaRegistros.js';

/*
 * O modo offline roda SEM banco e SEM variável de ambiente. Por isso nada que
 * dependa de `config/env` (prisma, logger, promptVersionService) entra por
 * import de topo: esses módulos são carregados só dentro do modo com banco,
 * por import dinâmico.
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

function imprimirPlano(antes: string, depois: string, plano: RegistroPlanejado[]): void {
  console.log(`\n== O que sai do prompt ==`);
  console.log(`  tamanho: ${antes.length} → ${depois.length} caracteres`);
  if (plano.length === 0) {
    console.log('  (nada a migrar: este prompt não tem patch colado)');
    return;
  }

  for (const r of plano) {
    const marca = r.status === 'ativa' ? '✅ ATIVA      ' : '📦 SUBSTITUIDA';
    const motivo = r.motivo ? ` (motivo: ${r.motivo})` : '';
    console.log(`\n  ${marca} cenário: ${r.scenarioId ?? '(sem cenário)'}${motivo}`);
    console.log(`     de: ${r.titulo.slice(0, 100)}`);
    console.log(`     texto: ${r.texto.slice(0, 160)}${r.texto.length > 160 ? '…' : ''}`);
  }

  const truncadas = plano.filter((r) => r.motivo === 'truncada');
  if (truncadas.length > 0) {
    console.log(`\n  ⚠️  ${truncadas.length} bloco(s) estavam CORTADOS no meio da frase.`);
    console.log('     Nenhum deles vira regra ativa: o dono aprovou um texto inteiro e o');
    console.log('     produto gravou metade (A188). Eles entram como histórico e a correção');
    console.log('     volta a ser oferecida, inteira, na próxima execução da Qualidade.');
    const semAtiva = new Set(
      plano
        .filter((r) => r.scenarioId && r.status === 'substituida')
        .map((r) => r.scenarioId as string),
    );
    for (const r of plano) if (r.scenarioId && r.status === 'ativa') semAtiva.delete(r.scenarioId);
    if (semAtiva.size > 0) {
      console.log(`     Cenários que ficam SEM regra ativa: ${[...semAtiva].join(', ')}`);
    }
  }
}

/** SQL pronto para o roteiro do passo 3, com dollar-quoting. */
function imprimirInserts(
  plano: RegistroPlanejado[],
  organizationId: string,
  agentId: string,
): void {
  if (plano.length === 0) return;
  console.log(`\n== INSERT das regras (passo 3 do roteiro) ==`);
  const colide = plano.find((r) => r.texto.includes('$texto$'));
  if (colide) {
    console.log(
      '⚠️  Uma das regras contém a própria marca de dollar-quoting ($texto$). Troque a marca\n' +
        '    por outra (por exemplo $regra1$) nesse INSERT antes de rodar, ou o SQL quebra.',
    );
  }
  for (const r of plano) {
    const cenario = r.scenarioId ? `'${r.scenarioId}'` : 'NULL';
    const motivo = r.motivo ? `'${r.motivo}'` : 'NULL';
    console.log(
      `INSERT INTO agent_rules (organization_id, agent_id, scenario_id, texto, origem, status, motivo, created_by)\n` +
        `VALUES ('${organizationId}', '${agentId}', ${cenario}, $texto$${r.texto}$texto$, 'manual', '${r.status}', ${motivo}, 'migracao');`,
    );
  }
}

/** Modo (b): sem banco. Lê um arquivo, transforma, grava outro. */
function modoOffline(entrada: string, saida: string): void {
  const antes = readFileSync(entrada, 'utf8');
  const { blocos, promptLimpo } = extrairPatches(antes);
  const plano = planejarRegistros(blocos);

  console.log(`\n== OFFLINE (sem banco) ==`);
  console.log(`  entrada: ${entrada}`);
  imprimirPlano(antes, promptLimpo, plano);

  const v = validarPromptLimpo(antes, promptLimpo, blocos);
  if (!v.ok) {
    console.error('\n❌ Recusado. Nada foi escrito:');
    for (const m of v.motivos) console.error(`   - ${m}`);
    process.exitCode = 1;
    return;
  }

  writeFileSync(saida, promptLimpo, 'utf8');
  console.log(`\n✅ Prompt limpo escrito em: ${saida}`);
  console.log(`   md5 do resultado: ${md5(promptLimpo)}`);
  imprimirInserts(plano, '<organization_id>', '<agent_id>');
  console.log('\n   Grave em produção pelo SQL do cabeçalho, com set_config e dollar-quoting.');
}

/** Modo (a): lê os agentes do banco e, com --apply, grava. */
async function modoBanco(apply: boolean, agentIdFiltro?: string): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error(
      '❌ DATABASE_URL não está no ambiente. Use o modo --in/--out ou rode pelo .command.',
    );
    process.exitCode = 1;
    return;
  }
  console.log(`\nBanco: ${mascararHost(process.env.DATABASE_URL)}`);
  console.log(apply ? 'Modo: APLICAR (vai escrever)\n' : 'Modo: DRY-RUN (não escreve nada)\n');

  const { prisma } = await import('@zappiq/database');
  const { publishPrompt, hashPrompt } = await import('../src/services/promptVersionService.js');

  const agentes = await prisma.agent.findMany({
    where: agentIdFiltro
      ? { id: agentIdFiltro }
      : {
          OR: [
            { systemPrompt: { contains: '# PATCH MANUAL' } },
            { systemPrompt: { contains: 'REGRA INVIOLÁVEL' } },
          ],
        },
    select: { id: true, name: true, organizationId: true, systemPrompt: true },
  });

  if (agentes.length === 0) {
    console.log('Nenhum agente com patch colado. Nada a fazer.');
    return;
  }

  for (const a of agentes) {
    const antes = a.systemPrompt ?? '';
    console.log(`\n─────────────────────────────────────────────`);
    console.log(`Agente "${a.name}" (${a.id}), organização ${a.organizationId}`);

    const { blocos, promptLimpo } = extrairPatches(antes);
    const plano = planejarRegistros(blocos);
    imprimirPlano(antes, promptLimpo, plano);

    if (plano.length === 0) continue;

    const v = validarPromptLimpo(antes, promptLimpo, blocos);
    if (!v.ok) {
      console.log('  ❌ Recusado, nada gravado:');
      for (const m of v.motivos) console.log(`     - ${m}`);
      process.exitCode = 1;
      continue;
    }

    if (!apply) {
      imprimirInserts(plano, a.organizationId, a.id);
      continue;
    }

    // Uma transação por agente: ou o prompt limpo e as regras entram juntos,
    // ou nada entra. Um prompt limpo sem as regras deixaria o agente sem as
    // correções que o dono aprovou.
    await prisma.$transaction(async (tx) => {
      for (const r of plano) {
        await tx.agentRule.create({
          data: {
            organizationId: a.organizationId,
            agentId: a.id,
            scenarioId: r.scenarioId,
            texto: r.texto,
            origem: 'manual',
            status: r.status,
            motivo: r.motivo,
            createdBy: 'migracao',
          },
        });
      }
      await publishPrompt(
        {
          agentId: a.id,
          systemPrompt: promptLimpo,
          source: 'migracao',
          actor: 'migrarPatchesParaRegistros',
          expectedHash: hashPrompt(antes),
        },
        tx as any,
      );
    });

    console.log(`  ✅ ${plano.length} regra(s) criadas e prompt publicado (source 'migracao').`);
  }

  if (!apply) {
    console.log('\n(DRY-RUN: nada foi escrito. Rode com --apply para gravar.)');
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const entrada = args[args.indexOf('--in') + 1];
  const saida = args[args.indexOf('--out') + 1];

  if (args.includes('--in') && args.includes('--out') && entrada && saida) {
    modoOffline(entrada, saida);
    return;
  }

  const agente = args.includes('--agent') ? args[args.indexOf('--agent') + 1] : undefined;
  await modoBanco(args.includes('--apply'), agente);
}

main().catch((err) => {
  console.error('❌ Falhou:', err?.message ?? err);
  process.exitCode = 1;
});
