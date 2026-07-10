/**
 * Gera o corpus de conhecimento da Iza Ajuda a partir do registro de Saiba mais
 * (Fase 1). SO entram itens clientSafe: true. Saida: um .ts tipado em
 * apps/api/src/data/izaAjudaCorpus.ts (nao JSON, pra ser compilado junto e
 * nunca sumir do dist).
 *
 * Rodar: npx tsx apps/api/scripts/build-iza-ajuda-corpus.ts
 * Reexecutar sempre que o conteudo de Saiba mais mudar (idealmente no build).
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SAIBA_MAIS } from '../../web/content/saiba-mais/index.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface HelpDoc {
  featureKey: string;
  titulo: string;
  texto: string;
}

const docs: HelpDoc[] = [];
let excluidosNaoSafe = 0;

for (const c of Object.values(SAIBA_MAIS)) {
  if (!c.clientSafe) {
    excluidosNaoSafe++;
    continue;
  }
  const texto = [
    `# ${c.titulo}`,
    `O que é: ${c.oQueE}`,
    `Para que serve: ${c.paraQueServe}`,
    `Como implementar: ${c.comoImplementar.map((p, i) => `${i + 1}. ${p}`).join(' ')}`,
    `Exemplo de resultado: ${c.exemploResultado}`,
  ].join('\n');
  docs.push({ featureKey: c.featureKey, titulo: c.titulo, texto });
}

const banner = `/**
 * GERADO AUTOMATICAMENTE por apps/api/scripts/build-iza-ajuda-corpus.ts
 * NAO EDITAR A MAO. Fonte: apps/web/content/saiba-mais (itens clientSafe).
 * Regenerar: npx tsx apps/api/scripts/build-iza-ajuda-corpus.ts
 */`;

const body = `${banner}

export interface HelpDoc {
  featureKey: string;
  titulo: string;
  texto: string;
}

export const IZA_AJUDA_CORPUS: HelpDoc[] = ${JSON.stringify(docs, null, 2)};
`;

const outDir = join(__dirname, '..', 'src', 'data');
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, 'izaAjudaCorpus.ts');
writeFileSync(outPath, body, 'utf-8');

console.log(`Corpus Iza Ajuda gerado: ${docs.length} docs clientSafe (${excluidosNaoSafe} excluidos por nao serem clientSafe).`);
console.log(`Arquivo: ${outPath}`);
