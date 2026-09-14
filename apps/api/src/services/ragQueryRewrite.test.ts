/**
 * ragQueryRewrite.test.ts (B4, consulta de continuação: A026, A064)
 * ============================================================================
 * A busca vetorial usava messageContent isolado. A mediana das mensagens
 * recebidas em 90 dias é de 18 caracteres: "e quanto fica?", "e o prazo?",
 * "sim", "esse". Uma pergunta dessas não carrega o assunto, então a busca
 * trazia trecho genérico (com o corte antigo sempre voltava algo) e o modelo
 * completava de memória.
 *
 * Aqui fica a parte determinística, que não gasta LLM nenhum: decidir se a
 * mensagem depende do contexto e, quando depende, montar a consulta com as
 * últimas mensagens do cliente. A reescrita boa vem do classificador que JÁ
 * roda por turno (A064: eram duas chamadas Haiku, não vamos criar uma terceira).
 * ============================================================================
 */
import { describe, it, expect } from 'vitest';
import {
  isContinuationQuery,
  isShortMessage,
  lastCustomerMessages,
  buildRetrievalQuery,
  sanitizeRewrittenQuery,
  parseClassifierOutput,
} from './ragQueryRewrite.js';

const conversa = [
  { role: 'user' as const, content: 'oi, queria saber do curso de fotografia noturna' },
  { role: 'assistant' as const, content: 'Claro! O curso de fotografia noturna tem 8 encontros.' },
  { role: 'user' as const, content: 'legal, e tem aula prática?' },
  { role: 'assistant' as const, content: 'Tem sim, duas aulas práticas no estúdio.' },
];

describe('isContinuationQuery', () => {
  it('reconhece as continuações curtas que a auditoria mediu', () => {
    for (const msg of ['e quanto fica?', 'e o outro?', 'sim', 'esse', 'ok, e aí?']) {
      expect(isContinuationQuery(msg), msg).toBe(true);
    }
  });

  it('limite conhecido: "e o prazo?" tem substantivo e não dispara a concatenação', () => {
    // Concatenar sem necessidade sujaria consulta boa. Quem resolve este caso é
    // a reescrita do classificador, liberada por isShortMessage.
    expect(isContinuationQuery('e o prazo?')).toBe(false);
    expect(isShortMessage('e o prazo?')).toBe(true);
  });

  it('NÃO trata como continuação a pergunta curta que já tem o assunto', () => {
    for (const msg of [
      'qual o preço?',
      'tem estacionamento?',
      'aceita pix?',
      'qual o horário?',
      'faz entrega?',
    ]) {
      expect(isContinuationQuery(msg), msg).toBe(false);
    }
  });

  it('NÃO trata como continuação mensagem longa, mesmo sem substantivo do domínio', () => {
    expect(
      isContinuationQuery('bom dia, eu gostaria de entender melhor como funciona isso tudo'),
    ).toBe(false);
  });

  it('ignora acento e caixa na checagem do substantivo', () => {
    expect(isContinuationQuery('e o HORÁRIO?')).toBe(false);
    expect(isContinuationQuery('e o horario?')).toBe(false);
  });

  it('mensagem vazia ou só pontuação não vira consulta de continuação', () => {
    expect(isContinuationQuery('')).toBe(false);
    expect(isContinuationQuery('   ')).toBe(false);
  });
});

describe('lastCustomerMessages', () => {
  it('devolve as últimas mensagens DO CLIENTE, em ordem cronológica', () => {
    expect(lastCustomerMessages(conversa, 2)).toEqual([
      'oi, queria saber do curso de fotografia noturna',
      'legal, e tem aula prática?',
    ]);
  });

  it('ignora o que o agente respondeu', () => {
    expect(lastCustomerMessages(conversa, 4).every((m) => !m.startsWith('Tem sim'))).toBe(true);
  });

  it('aguenta histórico vazio', () => {
    expect(lastCustomerMessages([], 2)).toEqual([]);
  });
});

describe('sanitizeRewrittenQuery', () => {
  it('aceita a reescrita do classificador, com espaço normalizado', () => {
    expect(sanitizeRewrittenQuery('  preço  do curso de fotografia\nnoturna ')).toBe(
      'preço do curso de fotografia noturna',
    );
  });

  it('recusa vazio, nulo e resposta curta demais', () => {
    expect(sanitizeRewrittenQuery(null)).toBeNull();
    expect(sanitizeRewrittenQuery('')).toBeNull();
    expect(sanitizeRewrittenQuery('ok')).toBeNull();
  });

  it('corta reescrita absurdamente longa (modelo devolvendo o histórico inteiro)', () => {
    const longa = sanitizeRewrittenQuery('palavra '.repeat(200));
    expect(longa!.length).toBeLessThanOrEqual(300);
  });
});

describe('parseClassifierOutput (A064: uma chamada só, dois campos)', () => {
  it('lê intenção e consulta do JSON', () => {
    const out = parseClassifierOutput(
      '{"intent":"pricing","consulta":"preço do curso de fotografia noturna"}',
    );
    expect(out.intent).toBe('pricing');
    expect(out.retrievalQuery).toBe('preço do curso de fotografia noturna');
  });

  it('aceita JSON embrulhado em cerca de código', () => {
    const out = parseClassifierOutput('```json\n{"intent":"faq","consulta":""}\n```');
    expect(out.intent).toBe('faq');
    expect(out.retrievalQuery).toBeNull();
  });

  it('resposta em texto puro continua valendo (cache antigo, modelo fraco)', () => {
    expect(parseClassifierOutput('request_human').intent).toBe('request_human');
    expect(parseClassifierOutput('  Greeting.\n').intent).toBe('greeting');
    expect(parseClassifierOutput('pricing').retrievalQuery).toBeNull();
  });

  it('categoria desconhecida vira other', () => {
    expect(parseClassifierOutput('bananas').intent).toBe('other');
    expect(parseClassifierOutput('').intent).toBe('other');
    expect(parseClassifierOutput(null).intent).toBe('other');
  });

  it('frase com DUAS categorias vira other, nunca dispara handoff por acidente', () => {
    expect(parseClassifierOutput('não é request_human, é faq').intent).toBe('other');
  });

  it('JSON com intenção inválida cai na leitura de texto puro', () => {
    expect(parseClassifierOutput('{"intent":"xyz","consulta":"algo"}').intent).toBe('other');
  });
});

describe('buildRetrievalQuery', () => {
  it('mensagem normal vai crua para a busca (nada muda no caminho quente)', () => {
    const out = buildRetrievalQuery({
      message: 'qual o preço do curso de fotografia noturna?',
      history: conversa,
    });
    expect(out.query).toBe('qual o preço do curso de fotografia noturna?');
    expect(out.origem).toBe('mensagem');
  });

  it('mensagem normal ignora a reescrita do classificador', () => {
    const out = buildRetrievalQuery({
      message: 'qual o preço do curso de fotografia noturna?',
      history: conversa,
      rewritten: 'outra coisa completamente diferente',
    });
    expect(out.origem).toBe('mensagem');
  });

  it('continuação com reescrita do classificador usa a reescrita', () => {
    const out = buildRetrievalQuery({
      message: 'e quanto fica?',
      history: conversa,
      rewritten: 'preço do curso de fotografia noturna',
    });
    expect(out.query).toBe('preço do curso de fotografia noturna');
    expect(out.origem).toBe('classificador');
  });

  it('continuação sem reescrita concatena as 2 últimas mensagens do cliente', () => {
    const out = buildRetrievalQuery({ message: 'e quanto fica?', history: conversa });
    expect(out.origem).toBe('heuristica');
    expect(out.query).toContain('e quanto fica?');
    expect(out.query).toContain('curso de fotografia noturna');
    expect(out.query).toContain('aula prática');
  });

  it('a concatenação não repete a própria mensagem quando ela já está no histórico', () => {
    const historico = [
      { role: 'user' as const, content: 'quanto custa o curso de fotografia noturna?' },
      { role: 'assistant' as const, content: 'São 8 encontros.' },
      { role: 'user' as const, content: 'e quanto fica?' },
    ];
    const out = buildRetrievalQuery({ message: 'e quanto fica?', history: historico });
    expect(out.query.match(/e quanto fica\?/g)).toHaveLength(1);
  });

  it('mensagem curta COM substantivo aceita a reescrita do classificador', () => {
    const out = buildRetrievalQuery({
      message: 'e o prazo?',
      history: conversa,
      rewritten: 'prazo de entrega do curso de fotografia noturna',
    });
    expect(out.query).toBe('prazo de entrega do curso de fotografia noturna');
    expect(out.origem).toBe('classificador');
  });

  it('mensagem curta COM substantivo e sem reescrita vai crua (não concatena)', () => {
    const out = buildRetrievalQuery({ message: 'e o prazo?', history: conversa });
    expect(out.query).toBe('e o prazo?');
    expect(out.origem).toBe('mensagem');
  });

  it('continuação sem histórico nenhum cai de volta na mensagem crua', () => {
    const out = buildRetrievalQuery({ message: 'sim', history: [] });
    expect(out.query).toBe('sim');
    expect(out.origem).toBe('mensagem');
  });

  it('reescrita inútil do classificador cai na heurística', () => {
    const out = buildRetrievalQuery({ message: 'e o outro?', history: conversa, rewritten: 'ok' });
    expect(out.origem).toBe('heuristica');
  });

  it('a consulta montada nunca estoura o limite de tamanho', () => {
    const historico = [
      { role: 'user' as const, content: 'a'.repeat(2000) },
      { role: 'user' as const, content: 'b'.repeat(2000) },
    ];
    const out = buildRetrievalQuery({ message: 'sim', history: historico });
    expect(out.query.length).toBeLessThanOrEqual(600);
  });
});
