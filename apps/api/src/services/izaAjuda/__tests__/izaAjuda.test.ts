/**
 * Testes da lógica pura da Iza Ajuda (retrieval + prompt).
 * Rodar: npx tsx apps/api/src/services/izaAjuda/__tests__/izaAjuda.test.ts
 */
import { tokenize, retrieve } from '../retrieval.js';
import { IZA_AJUDA_SYSTEM, buildContext, buildUserMessage } from '../prompt.js';
import { IZA_AJUDA_CORPUS } from '../../../data/izaAjudaCorpus.js';

let falhas = 0;
function check(cond: boolean, msg: string) {
  if (!cond) { falhas++; console.error('  FALHOU: ' + msg); }
}

// tokenize: minúsculas, sem acento, sem stopword, sem termo curto
const toks = tokenize('Como funciona o Pulso da IA?');
check(toks.includes('funciona'), 'tokenize deve manter "funciona"');
check(toks.includes('pulso'), 'tokenize deve manter "pulso"');
check(!toks.includes('como') && !toks.includes('da'), 'tokenize deve remover stopwords');

// corpus não vazio e só clientSafe (o gerador já filtra; aqui garante que carregou)
check(IZA_AJUDA_CORPUS.length >= 120, `corpus deveria ter >=120 docs, tem ${IZA_AJUDA_CORPUS.length}`);

// retrieve: pergunta sobre um recurso conhecido traz o doc certo no topo
const r1 = retrieve('o que é o pulso do analytics?', 6);
check(r1.length > 0, 'retrieve deve achar algo para "pulso"');
check(r1[0].doc.featureKey.includes('pulso') || r1.some((s) => s.doc.featureKey.includes('pulso')),
  'retrieve deve trazer analytics.pulso entre os tops');

// retrieve: pergunta sem correspondência retorna vazio (modelo dirá que não sabe)
const r2 = retrieve('zzzzqwykx', 6);
check(r2.length === 0, 'retrieve deve retornar vazio para termo inexistente');

// guardrails presentes no system prompt
for (const marca of ['Iza Ajuda', 'NUNCA', 'administrativos', 'travessão', 'invente']) {
  check(IZA_AJUDA_SYSTEM.toLowerCase().includes(marca.toLowerCase()), `system prompt deve conter "${marca}"`);
}

// contexto vazio quando não há docs
check(buildContext([]).includes('nenhum trecho relevante'), 'buildContext vazio deve avisar que não achou');

// user message inclui a pergunta e o material
const um = buildUserMessage('como conecto o whatsapp?', r1.map((s) => s.doc));
check(um.includes('como conecto o whatsapp?'), 'buildUserMessage deve conter a pergunta');
check(um.includes('MATERIAL DE AJUDA'), 'buildUserMessage deve conter o material');

if (falhas === 0) {
  console.log(`OK: Iza Ajuda logica pura integra (corpus ${IZA_AJUDA_CORPUS.length} docs).`);
} else {
  console.error(`\n${falhas} verificacao(oes) falharam.`);
  process.exit(1);
}
