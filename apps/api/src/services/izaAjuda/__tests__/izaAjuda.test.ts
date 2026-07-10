import { describe, it, expect } from 'vitest';
import { tokenize, retrieve } from '../retrieval.js';
import { IZA_AJUDA_SYSTEM, buildContext, buildUserMessage } from '../prompt.js';
import { IZA_AJUDA_CORPUS } from '../../../data/izaAjudaCorpus.js';

describe('tokenize', () => {
  it('mantém termos relevantes e remove stopwords', () => {
    const toks = tokenize('Como funciona o Pulso da IA?');
    expect(toks).toContain('funciona');
    expect(toks).toContain('pulso');
    expect(toks).not.toContain('como');
    expect(toks).not.toContain('da');
  });
});

describe('corpus', () => {
  it('carregou e é grande o suficiente', () => {
    expect(IZA_AJUDA_CORPUS.length).toBeGreaterThanOrEqual(120);
  });
});

describe('retrieve', () => {
  it('acha o doc certo para uma pergunta conhecida', () => {
    const r = retrieve('o que é o pulso do analytics?', 6);
    expect(r.length).toBeGreaterThan(0);
    expect(r.some((s) => s.doc.featureKey.includes('pulso'))).toBe(true);
  });
  it('retorna vazio para termo inexistente', () => {
    expect(retrieve('zzzzqwykx', 6)).toHaveLength(0);
  });
});

describe('guardrails no system prompt', () => {
  it('contém as marcas de segurança', () => {
    for (const marca of ['Iza Ajuda', 'NUNCA', 'administrativos', 'travessão', 'invente']) {
      expect(IZA_AJUDA_SYSTEM.toLowerCase()).toContain(marca.toLowerCase());
    }
  });
});

describe('montagem de contexto e mensagem', () => {
  it('avisa quando não há docs', () => {
    expect(buildContext([])).toContain('nenhum trecho relevante');
  });
  it('inclui a pergunta e o material', () => {
    const r = retrieve('como conecto o whatsapp?', 6);
    const um = buildUserMessage('como conecto o whatsapp?', r.map((s) => s.doc));
    expect(um).toContain('como conecto o whatsapp?');
    expect(um).toContain('MATERIAL DE AJUDA');
  });
});
