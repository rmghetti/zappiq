import { describe, it, expect } from 'vitest';
import {
  textDocSchema,
  isEditableDocument,
  planTextDocRagSync,
  normalizeQaUpdate,
  ALLOWED_UPLOAD_MIMES,
  isUploadMimeAllowed,
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

describe('planTextDocRagSync', () => {
  it('título inalterado: re-ingere no mesmo source, sem delete (replace-on-ingest cobre)', () => {
    expect(planTextDocRagSync('Política de troca', 'Política de troca')).toEqual({
      deleteSource: null,
      ingestSource: 'Política de troca',
    });
  });

  it('título alterado: remove o source antigo antes de ingerir o novo', () => {
    // Sem o delete, os chunks do título antigo ficam órfãos no vector store e a
    // IA segue respondendo com a versão anterior do texto.
    expect(planTextDocRagSync('Política de troca', 'Política de troca e devolução')).toEqual({
      deleteSource: 'Política de troca',
      ingestSource: 'Política de troca e devolução',
    });
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
   * Quando a conversão entrar, este teste muda NO MESMO PR que a entrega. */

  it('aceita os formatos que a ingestão realmente lê', () => {
    for (const mime of ['application/pdf', 'text/plain', 'text/markdown', 'text/csv']) {
      expect(isUploadMimeAllowed(mime), mime).toBe(true);
    }
  });

  it('recusa Word e Excel enquanto não houver extração', () => {
    const recusados = [
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    for (const mime of recusados) {
      expect(isUploadMimeAllowed(mime), mime).toBe(false);
      expect(ALLOWED_UPLOAD_MIMES.has(mime), mime).toBe(false);
    }
  });

  it('recusa o tipo genérico que o navegador manda quando não reconhece a extensão', () => {
    expect(isUploadMimeAllowed('application/octet-stream')).toBe(false);
    expect(isUploadMimeAllowed('')).toBe(false);
  });

  it('a lista tem exatamente os quatro formatos suportados', () => {
    expect([...ALLOWED_UPLOAD_MIMES].sort()).toEqual([
      'application/pdf',
      'text/csv',
      'text/markdown',
      'text/plain',
    ]);
  });
});
