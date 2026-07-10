/**
 * Gera o corpus de conhecimento da Iza Ajuda a partir do registro de Saiba mais
 * (Fase 1). SO entram itens clientSafe: true. Saida: apps/api/src/data/iza-ajuda-corpus.json.
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

const out = {
  geradoDe: 'apps/web/content/saiba-mais (registro Saiba mais clientSafe)',
  total: docs.length,
  docs,
};

const outDir = join(__dirname, '..', 'src', 'data');
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, 'iza-ajuda-corpus.json');
writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf-8');

console.log(`Corpus Iza Ajuda gerado: ${docs.length} docs clientSafe (${excluidosNaoSafe} excluidos por nao serem clientSafe).`);
console.log(`Arquivo: ${outPath}`);
