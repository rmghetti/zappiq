/**
 * Recuperação da base de conhecimento da Iza Ajuda.
 *
 * O corpus é pequeno (~129 docs curtos) e estático (ajuda de plataforma, igual
 * pra todo cliente), então uma busca por palavra-chave em memória resolve bem e
 * sem depender de infra de embeddings. Se um dia crescer, dá pra trocar por
 * embeddings sem mudar a interface.
 */
import { IZA_AJUDA_CORPUS, type HelpDoc } from '../../data/izaAjudaCorpus.js';

const STOPWORDS = new Set([
  'a','o','as','os','de','da','do','das','dos','e','ou','que','qual','quais','como','para','pra','por','com','sem',
  'um','uma','uns','umas','no','na','nos','nas','em','ao','aos','se','sua','seu','suas','seus','me','meu','minha',
  'eu','voce','você','é','ser','tem','ter','isso','esse','essa','este','esta','onde','quando','porque','pq','the',
]);

export function tokenize(s: string): string[] {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

export interface ScoredDoc {
  doc: HelpDoc;
  score: number;
}

/**
 * Retorna os top-k docs mais relevantes para a pergunta. Pontua por sobreposição
 * de termos, com peso extra pra casamento no título (mais forte que no corpo).
 */
export function retrieve(question: string, k = 6): ScoredDoc[] {
  const qTerms = new Set(tokenize(question));
  if (qTerms.size === 0) return [];

  const scored: ScoredDoc[] = [];
  for (const doc of IZA_AJUDA_CORPUS) {
    const tituloTerms = new Set(tokenize(doc.titulo));
    const textoTerms = tokenize(doc.texto);
    const textoSet = new Set(textoTerms);

    let score = 0;
    for (const t of qTerms) {
      if (tituloTerms.has(t)) score += 3;
      if (textoSet.has(t)) score += 1;
    }
    if (score > 0) scored.push({ doc, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}

export type { HelpDoc };
