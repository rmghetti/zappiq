/**
 * Limpeza dos prompts já gravados: tira o horário congelado, a data do
 * cadastro e o Fluxo de Agendamento do Agent.systemPrompt dos clientes.
 *
 * Por quê: o prompt é gravado uma vez, no cadastro, e nunca mais relido. Em
 * produção isso deixou 14 agentes com a data de julho, 4 afirmando "Domingo:
 * Fechado" para negócio aberto no domingo, e 15 mandando confirmar
 * agendamento e prometer lembrete 24 h e 1 h antes, sendo que o produto não
 * cria agendamento por essa ação nem envia lembrete nenhum. Consertar o
 * promptEngine só vale para cadastro novo; isto resolve o que já está lá.
 *
 * A lógica de texto está testada em src/agents/promptCongeladoLimpeza.test.ts
 * (13 testes, com o prompt real da Antonella como fixture). Aqui é só o CLI.
 *
 * ── Dois modos ────────────────────────────────────────────────────────
 *
 * 1) COM BANCO (padrão do promptRemediationService: snapshot, dry-run com
 *    diff por agente, recusa de gravação suja, gravação por publishPrompt
 *    com origem 'migracao', que o gatilho versiona):
 *
 *      npx tsx scripts/limparPromptsCongelados.ts --dry-run   # não escreve
 *      npx tsx scripts/limparPromptsCongelados.ts --apply     # grava
 *
 * 2) OFFLINE, sem banco nenhum, para a migração de PRODUÇÃO acontecer com
 *    revisão humana no meio. O operador exporta os prompts pelo MCP do
 *    Supabase, transforma aqui, LÊ O DIFF e só então grava por SQL:
 *
 *      npx tsx scripts/limparPromptsCongelados.ts --in antes.json --out depois.json
 *
 *    Formato do arquivo de entrada: [{ "id": "...", "system_prompt": "..." }]
 *
 * DATABASE_URL vem do AMBIENTE, nunca como argumento.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import {
  limparPromptCongelado,
  limparListaDePrompts,
  type PromptDeEntrada,
} from '../src/agents/promptCongeladoLimpeza.js';

// O banco e o publishPrompt entram por import DINÂMICO, dentro do modo com
// banco. Import estático puxaria o config/env, que exige DATABASE_URL e
// JWT_SECRET no ambiente: o modo offline deixaria de ser offline e não
// rodaria na máquina de quem só quer revisar o diff.

/** Mostra só o host: a senha do banco nunca vai para a tela nem para o log. */
function mascararHost(url?: string): string {
  if (!url) return '(não definida)';
  const m = url.match(/@([^:/?]+)/);
  return m ? m[1] : '(host não identificado)';
}

function imprimirRemovidos(removidos: string[], prefixo = '      '): void {
  for (const trecho of removidos) {
    const linhas = trecho.split('\n').filter(Boolean);
    console.log(`${prefixo}- sai: ${linhas[0]}`);
    for (const l of linhas.slice(1, 4)) console.log(`${prefixo}       ${l}`);
    if (linhas.length > 4) console.log(`${prefixo}       ... (+${linhas.length - 4} linhas)`);
  }
}

/* ── Modo offline: arquivo entra, arquivo sai, zero banco ─────────────── */
function rodarOffline(entradaPath: string, saidaPath: string): void {
  const bruto = readFileSync(entradaPath, 'utf8');
  const lista = JSON.parse(bruto) as PromptDeEntrada[];
  if (!Array.isArray(lista)) {
    throw new Error('O arquivo de entrada precisa ser uma lista [{ id, system_prompt }].');
  }

  console.log(`\n== MODO OFFLINE (sem banco) ==`);
  console.log(`Entrada: ${entradaPath}, ${lista.length} prompt(s)\n`);

  const saida = limparListaDePrompts(lista);

  let mudaram = 0;
  let recusados = 0;
  for (const item of saida) {
    if (item.recusa) {
      recusados++;
      console.log(`  ⚠️  ${item.id}: RECUSADO (${item.recusa}). Fica como está.`);
      continue;
    }
    if (!item.mudou) {
      console.log(`  ·  ${item.id}: nada a limpar.`);
      continue;
    }
    mudaram++;
    console.log(`  • ${item.id}`);
    imprimirRemovidos(item.removidos);
    console.log(`      prompt: ${item.system_prompt_antes.length} → ${item.system_prompt.length} chars\n`);
  }

  writeFileSync(saidaPath, JSON.stringify(saida, null, 2), 'utf8');
  console.log(`\n✅ ${mudaram} prompt(s) limpo(s), ${recusados} recusado(s).`);
  console.log(`   Saída: ${saidaPath}`);
  console.log('\nNada foi gravado em banco nenhum. Revise o diff antes de aplicar.');
}

/* ── Modo com banco ───────────────────────────────────────────────────── */
async function rodarComBanco(APPLY: boolean): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL não está no ambiente. Rode pelo .command.');
    process.exitCode = 1;
    return;
  }
  const { prisma } = await import('@zappiq/database');
  const { publishPrompt } = await import('../src/services/promptVersionService.js');

  try {
    console.log(`\nBanco: ${mascararHost(process.env.DATABASE_URL)}`);
    console.log(APPLY ? 'Modo: APLICAR (vai escrever)\n' : 'Modo: DRY-RUN (não escreve nada)\n');

    const agents = await prisma.agent.findMany({
      select: {
        id: true,
        name: true,
        systemPrompt: true,
        organizationId: true,
        organization: { select: { name: true } },
      },
    });

    const afetados = agents
      .map((a) => ({ agente: a, r: limparPromptCongelado(a.systemPrompt || '') }))
      .filter((x) => x.r.mudou);

    console.log(`Agents no banco: ${agents.length}`);
    console.log(`Prompts com texto congelado: ${afetados.length}\n`);

    if (afetados.length === 0) {
      console.log('✅ Nenhum prompt tem horário congelado, data do cadastro ou Fluxo de Agendamento.');
      return;
    }

    for (const { agente, r } of afetados) {
      const marca = r.recusa ? `⚠️  RECUSADO (${r.recusa})` : '•';
      console.log(`  ${marca} ${agente.organization?.name ?? '(sem nome)'}, agente "${agente.name}"`);
      imprimirRemovidos(r.removidos);
      if (r.recusa) console.log('      nada será gravado neste agente.\n');
      else console.log(`      prompt: ${(agente.systemPrompt || '').length} → ${r.prompt.length} chars\n`);
    }

    if (!APPLY) {
      console.log('Nada foi alterado. Para gravar de verdade, rode com --apply.');
      return;
    }

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const snapFile = `${process.env.HOME}/Desktop/zappiq-prompts-congelados-${stamp}.json`;
    writeFileSync(
      snapFile,
      JSON.stringify(
        afetados.map(({ agente, r }) => ({
          agentId: agente.id,
          agentName: agente.name,
          organizationId: agente.organizationId,
          orgName: agente.organization?.name ?? null,
          promptAntes: agente.systemPrompt,
          promptDepois: r.recusa ? agente.systemPrompt : r.prompt,
          removidos: r.removidos,
          recusa: r.recusa,
        })),
        null,
        2,
      ),
      'utf8',
    );
    console.log(`📸 Snapshot (prompts ANTES) salvo em:\n   ${snapFile}\n`);

    let gravados = 0;
    for (const { agente, r } of afetados) {
      if (r.recusa) continue;
      // publishPrompt declara a origem 'migracao' para o gatilho do Postgres
      // versionar a escrita. Sem isso, a versão nasceria como 'fora_do_app'.
      await publishPrompt({
        agentId: agente.id,
        systemPrompt: r.prompt,
        source: 'migracao',
        actor: 'migracao:prompts-congelados',
      });
      gravados++;
    }

    console.log('\n== Verificação (releitura do banco) ==');
    const sujos: string[] = [];
    for (const { agente } of afetados) {
      const fresh = await prisma.agent.findUnique({
        where: { id: agente.id },
        select: { systemPrompt: true },
      });
      const ainda = limparPromptCongelado(fresh?.systemPrompt || '');
      if (ainda.mudou && !ainda.recusa) sujos.push(agente.name);
    }
    if (sujos.length === 0) console.log('  ✅ Nenhum prompt com texto congelado.');
    else for (const s of sujos) console.log(`  ❌ ${s}: ainda tem texto congelado.`);

    console.log(`\n✅ ${gravados}/${afetados.length} prompt(s) gravado(s) como versão de migração.`);
    console.log(`\nPara desfazer, use o snapshot: ele traz promptAntes de cada agente.`);
  } finally {
    await prisma.$disconnect().catch(() => null);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const APPLY = args.includes('--apply');
  const inIdx = args.indexOf('--in');
  const outIdx = args.indexOf('--out');

  if (inIdx !== -1 || outIdx !== -1) {
    const entrada = inIdx !== -1 ? args[inIdx + 1] : null;
    const saida = outIdx !== -1 ? args[outIdx + 1] : null;
    if (!entrada || !saida) {
      console.error('❌ O modo offline precisa dos dois: --in <arquivo.json> --out <arquivo.json>');
      process.exitCode = 1;
      return;
    }
    rodarOffline(entrada, saida);
    return;
  }

  await rodarComBanco(APPLY);
}

main().catch((err) => {
  console.error('\n❌ Falhou:', err?.message ?? err);
  process.exitCode = 1;
});
