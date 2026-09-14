/**
 * promptWriters.guard.test.ts
 * ============================================================================
 * Trava de arquitetura, não de comportamento.
 *
 * O histórico de agent_prompt_versions só é confiável se TODA escrita em
 * agents.system_prompt declarar a origem antes de gravar. O gatilho do banco
 * versiona qualquer escrita, mas quem não declara a origem cai em
 * 'fora_do_app' e o rastro de quem pediu a mudança se perde.
 *
 * Este teste lê o código-fonte e falha se alguém voltar a escrever
 * `systemPrompt` direto num `agent.update(...)` ou `agent.create(...)`.
 * O caminho certo é publishPrompt().
 *
 * Duas exceções, de propósito:
 *   • promptVersionService.ts — é a porta;
 *   • agentProvisioningService.ts — o seed do agente novo, que precisa do
 *     create com o prompt inicial (e declara a origem 'seed' antes).
 *
 * Arquivos de teste ficam de fora: lá `agent.update` aparece em banco falso
 * e em asserção, não é escrita de verdade.
 * ============================================================================
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = join(fileURLToPath(new URL('.', import.meta.url)), '..');

/** Únicos arquivos autorizados a montar o systemPrompt numa escrita direta. */
const AUTORIZADOS = new Set(['services/promptVersionService.ts', 'services/agentProvisioningService.ts']);

function arquivosDeCodigo(dir: string, acc: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) {
      if (nome === 'node_modules' || nome === 'dist') continue;
      arquivosDeCodigo(caminho, acc);
      continue;
    }
    if (!nome.endsWith('.ts')) continue;
    if (nome.endsWith('.test.ts') || nome.endsWith('.spec.ts')) continue;
    acc.push(caminho);
  }
  return acc;
}

/** Recorta a chamada inteira a partir do '(' e devolve o texto entre parênteses. */
function corpoDaChamada(texto: string, posDoAbre: number): string {
  let profundidade = 0;
  for (let i = posDoAbre; i < texto.length; i++) {
    const c = texto[i];
    if (c === '(') profundidade++;
    else if (c === ')') {
      profundidade--;
      if (profundidade === 0) return texto.slice(posDoAbre + 1, i);
    }
  }
  return texto.slice(posDoAbre + 1);
}

/** Escritas diretas de systemPrompt encontradas no arquivo. */
export function escritasDiretasDePrompt(fonte: string): string[] {
  const achados: string[] = [];
  const regex = /\.?\bagent\.(update|create|updateMany|upsert)\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(fonte)) !== null) {
    const abre = fonte.indexOf('(', m.index);
    const corpo = corpoDaChamada(fonte, abre);
    if (/\bsystemPrompt\b/.test(corpo)) {
      const linha = fonte.slice(0, m.index).split('\n').length;
      achados.push(`linha ${linha}: agent.${m[1]}(... systemPrompt ...)`);
    }
  }
  return achados;
}

describe('escritasDiretasDePrompt (o detector em si)', () => {
  it('acha systemPrompt dentro de um agent.update', () => {
    const fonte = `await tx.agent.update({ where: { id }, data: { systemPrompt: novo } });`;
    expect(escritasDiretasDePrompt(fonte)).toHaveLength(1);
  });

  it('acha mesmo com a chamada quebrada em várias linhas', () => {
    const fonte = [
      'await db.agent.update({',
      '  where: { id: agent.id },',
      '  data: {',
      '    name: novo,',
      '    systemPrompt: promptNovo,',
      '  },',
      '});',
    ].join('\n');
    expect(escritasDiretasDePrompt(fonte)).toHaveLength(1);
  });

  it('não acusa update que não toca no prompt', () => {
    const fonte = `await db.agent.update({ where: { id }, data: { name: novo } });`;
    expect(escritasDiretasDePrompt(fonte)).toEqual([]);
  });

  it('não confunde com um objeto que só menciona systemPrompt depois da chamada', () => {
    const fonte = `await db.agent.update({ where: { id }, data: { name: n } });\nconst x = agent.systemPrompt;`;
    expect(escritasDiretasDePrompt(fonte)).toEqual([]);
  });
});

describe('ninguém escreve Agent.systemPrompt fora do promptVersionService', () => {
  it('só os dois arquivos autorizados montam systemPrompt num agent.update/create', () => {
    const infratores: string[] = [];

    for (const caminho of arquivosDeCodigo(SRC)) {
      const rel = relative(SRC, caminho).split('\\').join('/');
      if (AUTORIZADOS.has(rel)) continue;

      const achados = escritasDiretasDePrompt(readFileSync(caminho, 'utf8'));
      for (const a of achados) infratores.push(`${rel} → ${a}`);
    }

    expect(
      infratores,
      'Escrita direta em agents.system_prompt. Use publishPrompt() do promptVersionService ' +
        'para a origem da mudança chegar ao histórico:\n  ' +
        infratores.join('\n  '),
    ).toEqual([]);
  });

  it('encontra os arquivos do projeto (guarda contra caminho errado)', () => {
    const arquivos = arquivosDeCodigo(SRC).map((c) => relative(SRC, c));
    expect(arquivos.length).toBeGreaterThan(100);
    expect(arquivos).toContain(join('services', 'promptVersionService.ts'));
  });
});
