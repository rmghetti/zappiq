/**
 * As exceções de dependência valem nos DOIS portões, com o MESMO prazo.
 *
 * O osv-scanner lê o osv-scanner.toml, onde cada exceção tem id, motivo, dono e
 * `ignoreUntil`. Vencido o prazo, o scanner volta a apontar sozinho. Já o
 * `pnpm audit --prod --audit-level=high`, que é o passo que barra a PR no
 * ci.yml, não lê o toml: ele lê `pnpm.auditConfig.ignoreGhsas` no package.json
 * da raiz, e essa lista NÃO tem prazo nenhum. Sem este teste, um id esquecido
 * no package.json continuaria silenciando o portão para sempre, mesmo depois de
 * a exceção ter vencido (ou de nunca ter existido) no toml.
 *
 * Então aqui a regra é explícita: todo id silenciado no package.json precisa de
 * uma entrada no toml, com prazo, e o prazo precisa estar no futuro. O dia em
 * que vencer, a suíte fica vermelha e alguém decide: corrige a dependência ou
 * renova a exceção com motivo novo.
 *
 * O teste não usa parser de TOML de terceiro de propósito: o formato do arquivo
 * é nosso, é simples e a leitura por linha deixa claro o que está sendo lido.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ESTE_ARQUIVO = path.dirname(fileURLToPath(import.meta.url));
// apps/api/src/config -> apps/api/src -> apps/api -> apps -> raiz do monorepo
const RAIZ = path.resolve(ESTE_ARQUIVO, '../../../..');
const CAMINHO_TOML = path.join(RAIZ, 'osv-scanner.toml');
const CAMINHO_PACKAGE = path.join(RAIZ, 'package.json');

interface ExcecaoDoOsv {
  id: string;
  /** Texto cru do `ignoreUntil`, ou null quando a entrada não declarou prazo. */
  prazo: string | null;
}

/**
 * Lê os blocos `[[IgnoredVulns]]` do osv-scanner.toml.
 *
 * Linha comentada é descartada antes de qualquer coisa, porque o cabeçalho do
 * arquivo documenta o formato com um `[[IgnoredVulns]]` de exemplo dentro de um
 * comentário. Sem descartar, o exemplo viraria uma exceção fantasma.
 */
export function lerExcecoesDoOsv(texto: string): ExcecaoDoOsv[] {
  const excecoes: ExcecaoDoOsv[] = [];
  let atual: ExcecaoDoOsv | null = null;

  for (const linhaCrua of texto.split('\n')) {
    const linha = linhaCrua.trim();
    if (linha === '' || linha.startsWith('#')) continue;

    if (linha.startsWith('[')) {
      // Qualquer outra tabela (por exemplo [[PackageOverrides]]) fecha o bloco.
      if (atual) excecoes.push(atual);
      atual = linha === '[[IgnoredVulns]]' ? { id: '', prazo: null } : null;
      continue;
    }

    if (!atual) continue;

    const id = linha.match(/^id\s*=\s*"([^"]+)"/);
    if (id) {
      atual.id = id[1];
      continue;
    }

    const prazo = linha.match(/^ignoreUntil\s*=\s*([^#\s]+)/);
    if (prazo) atual.prazo = prazo[1];
  }

  if (atual) excecoes.push(atual);
  return excecoes.filter((e) => e.id !== '');
}

const excecoesDoOsv = lerExcecoesDoOsv(readFileSync(CAMINHO_TOML, 'utf8'));
const idsSilenciadosNoPnpm: string[] = JSON.parse(readFileSync(CAMINHO_PACKAGE, 'utf8')).pnpm
  ?.auditConfig?.ignoreGhsas ?? [];

describe('exceções de auditoria de dependência', () => {
  it('a leitura do toml acha as exceções reais e ignora o exemplo do cabeçalho', () => {
    expect(excecoesDoOsv.length).toBeGreaterThan(0);
    expect(excecoesDoOsv.map((e) => e.id)).not.toContain('GHSA-xxxx-xxxx-xxxx');
    expect(excecoesDoOsv.every((e) => /^GHSA-/.test(e.id))).toBe(true);
  });

  it('todo id silenciado no pnpm audit tem entrada no osv-scanner.toml', () => {
    const noToml = new Set(excecoesDoOsv.map((e) => e.id));
    const orfaos = idsSilenciadosNoPnpm.filter((id) => !noToml.has(id));

    expect(
      orfaos,
      `Estes ids estão em pnpm.auditConfig.ignoreGhsas (package.json da raiz) e silenciam o ` +
        `pnpm audit, mas não têm exceção com motivo, dono e prazo no osv-scanner.toml: ` +
        `${orfaos.join(', ')}. Escreva a exceção no toml ou tire o id do package.json.`,
    ).toEqual([]);
  });

  it('todo id do osv-scanner.toml está silenciado também no pnpm audit', () => {
    const noPnpm = new Set(idsSilenciadosNoPnpm);
    const sobrando = excecoesDoOsv.map((e) => e.id).filter((id) => !noPnpm.has(id));

    expect(
      sobrando,
      `Estes ids têm exceção no osv-scanner.toml mas não estão em ` +
        `pnpm.auditConfig.ignoreGhsas: ${sobrando.join(', ')}. O pnpm audit vai ficar ` +
        `vermelho por um alerta que já foi aceito. Espelhe os dois lados.`,
    ).toEqual([]);
  });

  it('toda exceção declara prazo', () => {
    const semPrazo = excecoesDoOsv.filter((e) => e.prazo === null).map((e) => e.id);

    expect(
      semPrazo,
      `Estas exceções do osv-scanner.toml não têm ignoreUntil: ${semPrazo.join(', ')}. ` +
        `Exceção sem validade vira dívida invisível.`,
    ).toEqual([]);
  });

  it('nenhuma exceção usada pelo pnpm audit está com o prazo vencido', () => {
    const agora = new Date();
    const vencidas = excecoesDoOsv
      .filter((e) => idsSilenciadosNoPnpm.includes(e.id))
      .filter((e) => e.prazo !== null && new Date(e.prazo).getTime() < agora.getTime())
      .map((e) => `${e.id} (venceu em ${e.prazo})`);

    expect(
      vencidas,
      `Estas exceções venceram no osv-scanner.toml e continuam silenciando o pnpm audit, ` +
        `que é o passo que barra a PR: ${vencidas.join(', ')}. Corrija a dependência ou ` +
        `renove a exceção com motivo novo, nos dois arquivos.`,
    ).toEqual([]);
  });

  it('o prazo lido é uma data válida', () => {
    const invalidas = excecoesDoOsv
      .filter((e) => e.prazo !== null && Number.isNaN(new Date(e.prazo).getTime()))
      .map((e) => `${e.id} (${e.prazo})`);

    expect(invalidas, `ignoreUntil ilegível em: ${invalidas.join(', ')}`).toEqual([]);
  });
});
