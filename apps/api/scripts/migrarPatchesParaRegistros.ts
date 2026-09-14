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
 *   • bloco TRUNCADO (para no meio da frase, sem pontuação final, OU com
 *     aspa aberta que nunca fecha)
 *                                          -> NUNCA fica ativo. Nasce
 *                                             'substituida' com motivo
 *                                             'truncada' e vai listado no
 *                                             relatório.
 *   • "Rod" (o nome fictício do cenário de teste, A172) vira "[nome]" no
 *     texto da regra. Palavra inteira: "Rodrigo" e "Rodoviária" ficam.
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
 *   # (a) gravando: limpa o prompt por publishPrompt e cria os registros.
 *   #     Um agente por vez: --apply sem --agent é RECUSADO (exit 1) antes
 *   #     de conectar.
 *   npx tsx scripts/migrarPatchesParaRegistros.ts --apply --agent <id>
 *
 *   # (b) modo OFFLINE, sem banco: lê um arquivo e escreve o prompt limpo
 *   npx tsx scripts/migrarPatchesParaRegistros.ts --in prompt.txt --out limpo.txt
 *
 *   # --help (ou sem argumento nenhum): mostra o uso e sai com 0, sem
 *   # tocar no banco. Argumento desconhecido é recusado.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * ROTEIRO DE APLICAÇÃO EM PRODUÇÃO (sem credencial de banco na máquina de
 * ninguém: o prompt sai por SELECT, é transformado offline e volta por UPDATE)
 *
 * PASSO 1: exportar o prompt
 *
 *   SELECT id, name, organization_id, length(system_prompt) AS chars,
 *          md5(system_prompt) AS hash, system_prompt
 *     FROM agents
 *    WHERE system_prompt LIKE '%# PATCH MANUAL%'
 *       OR system_prompt LIKE '%REGRA INVIOLÁVEL%';
 *
 *   Salve o system_prompt de cada agente em ~/Desktop/<nome>-antes.txt e
 *   anote o id, a organization_id e o hash.
 *
 * PASSO 2: transformar offline (sem banco, sem variável de ambiente)
 *
 *   cd ~/dev/zappiq/apps/api
 *   npx tsx scripts/migrarPatchesParaRegistros.ts \
 *     --in  ~/Desktop/marcia-antes.txt \
 *     --out ~/Desktop/marcia-depois.txt
 *
 *   O script imprime o md5 da ENTRADA (o md5 do arquivo exportado, byte a
 *   byte), cada bloco encontrado, o status que ele teria (ativa/substituida)
 *   e o motivo, o tamanho, o md5 do resultado e o INSERT pronto de cada
 *   regra. Recusa escrever se a validação reprovar.
 *
 *   Confira: o md5 da entrada tem de ser IGUAL ao hash do passo 1. Diferente
 *   quer dizer que o arquivo salvo não é o prompt vivo inteiro (a cópia
 *   perdeu uma linha, ganhou uma quebra no fim, trocou aspas): refaça o
 *   passo 1. De qualquer jeito, a trava do UPDATE abaixo usa o md5 da
 *   entrada, e não o do SELECT, justamente para barrar esse caso.
 *
 * PASSO 3: gravar, ligar o interruptor e PROVAR, tudo antes do COMMIT
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
 *        AND md5(system_prompt) = '<md5 da entrada que o script imprimiu no passo 2>';
 *     -- 0 linhas = o arquivo exportado não é o prompt vivo (cópia cortada ou
 *     -- alterada) ou alguém gravou no meio do caminho: ROLLBACK e refaça do
 *     -- passo 1.
 *
 *     -- As regras, na ordem que o script imprimir (uma linha por bloco):
 *     INSERT INTO agent_rules
 *       (organization_id, agent_id, scenario_id, texto, origem, status, motivo, created_by)
 *     VALUES
 *       ('<org>', '<agent>', 'cr5_nome_disponivel_usar',
 *        $texto$...$texto$, 'manual', 'ativa', NULL, 'migracao');
 *
 *     -- O interruptor da organização, NA MESMA transação. Ligar antes da
 *     -- migração faria o agente receber a regra duas vezes (no texto colado
 *     -- e no bloco); ligar depois do COMMIT deixaria o agente SEM as
 *     -- correções no intervalo (o texto colado já saiu e o bloco ainda não
 *     -- entra). O prazo é o do registro (FLAGS.regrasComoRegistros.removeBy
 *     -- em src/services/featureFlags.ts), o mesmo que a rota admin grava.
 *     INSERT INTO org_feature_flags
 *       (organization_id, flag, enabled, remove_by, updated_by)
 *     VALUES
 *       ('<org>', 'regrasComoRegistros', true, '2027-06-30', 'migrarPatchesParaRegistros')
 *     ON CONFLICT (organization_id, flag) DO UPDATE
 *        SET enabled = true,
 *            remove_by = EXCLUDED.remove_by,
 *            updated_by = EXCLUDED.updated_by,
 *            updated_at = now();
 *
 *     -- PROVA, ainda dentro da transação. As CINCO têm de dar certo:
 *     SELECT count(*) FROM agents
 *      WHERE id = '<agent>' AND system_prompt LIKE '%# PATCH MANUAL%';   -- 0
 *     SELECT count(*) FROM agents
 *      WHERE id = '<agent>' AND system_prompt LIKE '%## IDENTIDADE%';    -- 1
 *     SELECT scenario_id, count(*) FROM agent_rules
 *      WHERE agent_id = '<agent>' AND status = 'ativa' AND scenario_id IS NOT NULL
 *      GROUP BY 1 HAVING count(*) > 1;                                   -- 0 linhas
 *     -- 4a prova: o que entrou no banco é o arquivo revisado, inteiro.
 *     -- As três acima passariam mesmo com o prompt cortado pelo caminho (um
 *     -- copiar e colar que perde a última linha, por exemplo). O número a
 *     -- comparar é o Y da linha "tamanho: X → Y" que o script imprime. Ele
 *     -- conta PONTOS DE CÓDIGO (cada emoji vale 1), que é exatamente o que
 *     -- o length() do Postgres devolve. Não use o `.length` do JS nem o
 *     -- `wc -c` do terminal para conferir: o primeiro conta o emoji como 2
 *     -- e o segundo conta BYTES (os acentos valem 2), e os dois dariam um
 *     -- número maior sem o prompt estar errado.
 *     SELECT length(system_prompt), md5(system_prompt) FROM agents
 *      WHERE id = '<agent>';        -- iguais ao Y e ao md5 do resultado impressos
 *     -- 5a prova: o interruptor ficou ligado junto.
 *     SELECT enabled FROM org_feature_flags
 *      WHERE organization_id = '<org>' AND flag = 'regrasComoRegistros';  -- true
 *     -- qualquer divergência -> ROLLBACK;
 *     COMMIT;
 *
 *   Cache de 30 s: a API guarda o valor de cada interruptor por 30 segundos
 *   (FLAG_CACHE_TTL_SECONDS em src/services/featureFlags.ts), e gravar pelo
 *   SQL não limpa esse cache (só a rota admin limpa). Por até 30 s depois do
 *   COMMIT, um processo da API ainda pode ler a flag desligada e montar o
 *   prompt sem o texto colado e sem o bloco. Rode no horário de menos
 *   conversa. No chat do site o texto gravado tem cache próprio de 5
 *   minutos: nesse intervalo a regra pode aparecer duas vezes (no texto
 *   antigo e no bloco), o que não tira correção nenhuma.
 *
 * PASSO 4: conferir depois do COMMIT (e depois dos 30 s)
 *
 *     SELECT version, source, created_by, hash, created_at
 *       FROM agent_prompt_versions
 *      WHERE agent_id = '<agent>' ORDER BY version DESC LIMIT 3;
 *     -- a de cima: source 'migracao', hash = md5 do resultado do passo 2;
 *     -- a de baixo dela: hash = md5 da entrada do passo 2 (é a que o
 *     -- DESFAZER restaura).
 *
 *   E no Raio-X da IA (admin), o prompt do agente mostra o bloco
 *   "# Regras aprovadas pelo dono" com as regras ativas.
 *
 * DESFAZER (numa transação só: prompt, regras e interruptor voltam juntos)
 *
 *   A flag é da ORGANIZAÇÃO. Se ela tiver outro agente já migrado, desfaça
 *   os dois na mesma transação. Regra que o dono aprovou DEPOIS da migração
 *   também sai do ar com a flag desligada; confira antes:
 *     SELECT id, scenario_id, created_by FROM agent_rules
 *      WHERE organization_id = '<org>' AND status = 'ativa'
 *        AND created_by <> 'migracao';
 *
 *     BEGIN;
 *     SELECT set_config('zappiq.prompt_source', 'migracao', true);
 *     SELECT set_config('zappiq.prompt_actor', 'migrarPatchesParaRegistros:desfazer', true);
 *
 *     -- O prompt de antes, tirado da versão que o gatilho gravou.
 *     UPDATE agents
 *        SET system_prompt = (
 *              SELECT v.system_prompt FROM agent_prompt_versions v
 *               WHERE v.agent_id = '<agent>'
 *                 AND v.hash = '<md5 da entrada do passo 2>'
 *               ORDER BY v.version DESC LIMIT 1),
 *            updated_at = now()
 *      WHERE id = '<agent>'
 *        AND md5(system_prompt) = '<md5 do resultado do passo 2>'
 *        AND EXISTS (SELECT 1 FROM agent_prompt_versions v
 *                     WHERE v.agent_id = '<agent>'
 *                       AND v.hash = '<md5 da entrada do passo 2>');
 *     -- 0 linhas = o prompt mudou depois da migração (alguém gravou por
 *     -- cima): ROLLBACK e decida à mão.
 *
 *     -- As regras que a migração criou saem de 'ativa'. Nada é apagado.
 *     UPDATE agent_rules
 *        SET status = 'revertida', motivo = 'migracao_desfeita', updated_at = now()
 *      WHERE agent_id = '<agent>' AND created_by = 'migracao' AND status = 'ativa';
 *
 *     UPDATE org_feature_flags
 *        SET enabled = false,
 *            updated_by = 'migrarPatchesParaRegistros:desfazer',
 *            updated_at = now()
 *      WHERE organization_id = '<org>' AND flag = 'regrasComoRegistros';
 *
 *     -- PROVA antes do COMMIT:
 *     SELECT md5(system_prompt) FROM agents WHERE id = '<agent>';
 *       -- igual ao md5 da entrada do passo 2
 *     SELECT count(*) FROM agent_rules
 *      WHERE agent_id = '<agent>' AND created_by = 'migracao' AND status = 'ativa';  -- 0
 *     SELECT enabled FROM org_feature_flags
 *      WHERE organization_id = '<org>' AND flag = 'regrasComoRegistros';          -- false
 *     COMMIT;
 *
 *   O mesmo cache de 30 s vale aqui, no sentido contrário.
 * ══════════════════════════════════════════════════════════════════════════
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import {
  extrairPatches,
  planejarRegistros,
  validarPromptLimpo,
  contarCaracteres,
  lerArgumentosDaMigracao,
  USO_DA_MIGRACAO,
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
  // Pontos de código, igual ao length() do Postgres. O .length do JS conta o
  // emoji como 2 e a 4a prova do roteiro compararia números diferentes.
  console.log(`  tamanho: ${contarCaracteres(antes)} → ${contarCaracteres(depois)} caracteres`);
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
  // O md5 da ENTRADA é o que a trava `AND md5(system_prompt) = '...'` do
  // passo 3 confere: se o arquivo exportado não for o prompt vivo inteiro
  // (cópia cortada ou alterada) ou se alguém gravou depois do SELECT, o
  // UPDATE casa 0 linhas em vez de gravar por cima.
  console.log(`  md5 da entrada: ${md5(antes)}`);
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
  console.log('\n   Grave em produção pelo SQL do cabeçalho (passo 3): set_config, dollar-quoting,');
  console.log('   o md5 da entrada na trava do UPDATE e o interruptor na mesma transação.');
}

/** Modo (a): lê os agentes do banco e, com --apply, grava. */
async function modoBanco(apply: boolean, agentIdFiltro?: string): Promise<void> {
  // Segunda trava, para quem chamar esta função sem passar pelo main.
  if (apply && !agentIdFiltro) {
    console.error('❌ Recusado: --apply exige --agent <id>. Nada foi feito.');
    process.exitCode = 1;
    return;
  }
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
  // A decisão sai de uma função pura e testada, ANTES de qualquer import de
  // banco: `--help` não conecta, e `--apply` sem `--agent` é recusado aqui.
  const comando = lerArgumentosDaMigracao(process.argv.slice(2));

  if (comando.modo === 'ajuda') {
    console.log(USO_DA_MIGRACAO);
    return;
  }
  if (comando.modo === 'recusado') {
    console.error(`❌ Recusado: ${comando.motivo}\n`);
    console.error(USO_DA_MIGRACAO);
    process.exitCode = 1;
    return;
  }
  if (comando.modo === 'offline') {
    modoOffline(comando.entrada, comando.saida);
    return;
  }
  await modoBanco(comando.aplicar, comando.agentId);
}

main().catch((err) => {
  console.error('❌ Falhou:', err?.message ?? err);
  process.exitCode = 1;
});
