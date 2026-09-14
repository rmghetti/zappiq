import { describe, it, expect } from 'vitest';
import {
  textDocSchema,
  isEditableDocument,
  normalizeQaUpdate,
  ALLOWED_UPLOAD_MIMES,
  ALLOWED_UPLOAD_EXTENSIONS,
  isUploadAllowed,
} from './aiTraining.text.util.js';

describe('textDocSchema (colar texto direto)', () => {
  it('aceita título e conteúdo válidos', () => {
    const r = textDocSchema.safeParse({
      title: 'Política de troca',
      content: 'Aceitamos trocas em até 7 dias corridos com nota fiscal e produto sem uso.',
    });
    expect(r.success).toBe(true);
  });

  it('faz trim de título e conteúdo', () => {
    const r = textDocSchema.parse({
      title: '  Horário  ',
      content: '   Atendemos de segunda a sexta das 9h às 18h, sábado até meio-dia.   ',
    });
    expect(r.title).toBe('Horário');
    expect(r.content.startsWith('Atendemos')).toBe(true);
  });

  it('rejeita conteúdo curto demais (não vira conhecimento útil)', () => {
    expect(textDocSchema.safeParse({ title: 'X', content: 'oi' }).success).toBe(false);
    expect(textDocSchema.safeParse({ title: 'Título ok', content: 'muito curto' }).success).toBe(false);
  });

  it('rejeita título vazio e conteúdo acima do teto', () => {
    expect(textDocSchema.safeParse({ title: '', content: 'x'.repeat(50) }).success).toBe(false);
    expect(textDocSchema.safeParse({ title: 'ok', content: 'x'.repeat(50001) }).success).toBe(false);
  });
});

describe('isEditableDocument', () => {
  it('só texto colado é editável', () => {
    expect(isEditableDocument('text')).toBe(true);
  });

  it('rejeita URL e arquivos — o conteúdo deles vem da fonte, não do usuário', () => {
    expect(isEditableDocument('url')).toBe(false);
    expect(isEditableDocument('application/pdf')).toBe(false);
    expect(isEditableDocument('text/plain')).toBe(false); // mime de upload .txt, não é o texto colado
    expect(isEditableDocument('text/markdown')).toBe(false);
    expect(isEditableDocument('')).toBe(false);
    expect(isEditableDocument('Text')).toBe(false); // case-sensitive: sourceType é gravado em lower
  });
});

describe('normalizeQaUpdate', () => {
  it('categoria apagada vira null (o cliente consegue tirar a categoria)', () => {
    expect(normalizeQaUpdate({ question: 'P', category: '' })).toEqual({ question: 'P', category: null });
    expect(normalizeQaUpdate({ category: '   ' })).toEqual({ category: null });
  });

  it('categoria preenchida passa intacta', () => {
    expect(normalizeQaUpdate({ category: 'Horários' })).toEqual({ category: 'Horários' });
  });

  it('não inventa campo: sem category no payload, nada é adicionado', () => {
    // O toggle Ativar/Desativar manda só { isActive } — não pode virar
    // um update que apaga a categoria.
    expect(normalizeQaUpdate({ isActive: false })).toEqual({ isActive: false });
    expect('category' in normalizeQaUpdate({ isActive: false })).toBe(false);
  });

  it('não muta o objeto recebido', () => {
    const body = { category: '' };
    normalizeQaUpdate(body);
    expect(body.category).toBe('');
  });
});

describe('formatos aceitos no upload da base de conhecimento', () => {
  /* O serviço de extração lê PDF e text/*. Word e Excel voltam 415, o erro
   * chega sem statusCode e em produção vira 'Internal Server Error' na cara
   * do cliente, sem nenhum documento criado. Enquanto a extração desses dois
   * não existir, eles não podem passar pelo filtro nem aparecer na tela.
   * Quando a conversão entrar, este teste muda NO MESMO PR que a entrega.
   *
   * O filtro olha mime OU extensão porque o navegador mente sobre o mime: no
   * Windows um .csv chega como application/vnd.ms-excel e um .md chega como
   * application/octet-stream ou vazio. Recusar por mime punia o cliente que
   * mandou o arquivo certo. */

  it('aceita os formatos que a ingestão realmente lê', () => {
    const aceitos: [string, string][] = [
      ['application/pdf', 'manual.pdf'],
      ['text/plain', 'horarios.txt'],
      ['text/markdown', 'politica.md'],
      ['text/csv', 'tabela.csv'],
    ];
    for (const [mime, nome] of aceitos) {
      expect(isUploadAllowed(mime, nome), `${mime} ${nome}`).toBe(true);
    }
  });

  it('aceita .csv que o Windows rotula como Excel', () => {
    // Causa real de recusa injusta: o navegador manda o mime do programa que
    // abre a extensão, não o do conteúdo.
    expect(isUploadAllowed('application/vnd.ms-excel', 'tabela-de-precos.csv')).toBe(true);
  });

  it('aceita .md que chega sem mime nenhum', () => {
    expect(isUploadAllowed('', 'politica-de-troca.md')).toBe(true);
    expect(isUploadAllowed('application/octet-stream', 'politica-de-troca.md')).toBe(true);
  });

  it('não diferencia caixa na extensão', () => {
    expect(isUploadAllowed('application/octet-stream', 'MANUAL.PDF')).toBe(true);
    expect(isUploadAllowed('', 'Tabela.CSV')).toBe(true);
  });

  it('recusa Word e Excel de verdade enquanto não houver extração', () => {
    const recusados: [string, string][] = [
      ['application/msword', 'contrato.doc'],
      [
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'contrato.docx',
      ],
      ['application/vnd.ms-excel', 'planilha.xls'],
      [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'planilha.xlsx',
      ],
    ];
    for (const [mime, nome] of recusados) {
      expect(isUploadAllowed(mime, nome), `${mime} ${nome}`).toBe(false);
      expect(ALLOWED_UPLOAD_MIMES.has(mime), mime).toBe(false);
    }
  });

  it('recusa executável, mesmo com o mime genérico do navegador', () => {
    expect(isUploadAllowed('application/octet-stream', 'instalador.exe')).toBe(false);
    expect(isUploadAllowed('application/x-msdownload', 'instalador.exe')).toBe(false);
    expect(isUploadAllowed('', 'instalador.exe')).toBe(false);
  });

  it('recusa o genérico quando nem a extensão ajuda', () => {
    expect(isUploadAllowed('application/octet-stream', 'arquivo')).toBe(false);
    expect(isUploadAllowed('', '')).toBe(false);
  });

  it('as duas listas têm exatamente os quatro formatos suportados', () => {
    expect([...ALLOWED_UPLOAD_MIMES].sort()).toEqual([
      'application/pdf',
      'text/csv',
      'text/markdown',
      'text/plain',
    ]);
    expect([...ALLOWED_UPLOAD_EXTENSIONS].sort()).toEqual(['.csv', '.md', '.pdf', '.txt']);
  });
});
