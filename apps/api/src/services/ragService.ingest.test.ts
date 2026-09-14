/**
 * Ingestão: o erro do serviço de indexação tem de chegar ao cliente com o
 * status e a frase que o serviço mandou.
 *
 * Até aqui o `ingestDocument` lançava `new Error('RAG ingest 415: ...')`, sem
 * statusCode. O errorHandler, em produção, transformava isso em 500 "Internal
 * Server Error", e a tela mostrava "Erro no upload: Internal Server Error"
 * (achados A003 e A004). A mensagem útil ficava só no log do servidor.
 */
import { describe, it, expect } from 'vitest';
import {
  RagRequestError,
  MENSAGEM_REDE_SOCIAL,
  MENSAGEM_RAG_INDISPONIVEL,
  ehRedeSocial,
  erroDaRespostaDoRag,
  falhaDeIngestao,
  buildIngestForm,
} from './ragService.js';

describe('erroDaRespostaDoRag', () => {
  it('repassa status e mensagem de um 415 do serviço', () => {
    const erro = erroDaRespostaDoRag(
      415,
      JSON.stringify({
        detail: 'Tipo de arquivo não aceito: envie PDF, Word (.docx), Excel (.xlsx), texto, Markdown ou CSV.',
      }),
    );

    expect(erro).toBeInstanceOf(RagRequestError);
    expect(erro.statusCode).toBe(415);
    expect(erro.message).toBe(
      'Tipo de arquivo não aceito: envie PDF, Word (.docx), Excel (.xlsx), texto, Markdown ou CSV.',
    );
  });

  it('repassa o 422 de PDF digitalizado', () => {
    const erro = erroDaRespostaDoRag(422, '{"detail":"Este PDF parece digitalizado, sem texto selecionável."}');

    expect(erro.statusCode).toBe(422);
    expect(erro.message).toContain('digitalizado');
  });

  it('repassa o 413 com o número do limite', () => {
    const erro = erroDaRespostaDoRag(413, '{"detail":"Arquivo de 31.7 MB acima do limite de 20 MB."}');

    expect(erro.statusCode).toBe(413);
    expect(erro.message).toContain('20 MB');
  });

  it('erro do lado do serviço vira indisponibilidade, não 4xx mentiroso', () => {
    const erro = erroDaRespostaDoRag(500, '{"error":"internal_server_error","detail":"boom"}');

    expect(erro.statusCode).toBe(503);
    expect(erro.message).toBe(MENSAGEM_RAG_INDISPONIVEL);
  });

  it('corpo que não é JSON não vira mensagem crua para o cliente', () => {
    const erro = erroDaRespostaDoRag(502, '<html>Bad Gateway</html>');

    expect(erro.statusCode).toBe(503);
    expect(erro.message).toBe(MENSAGEM_RAG_INDISPONIVEL);
    expect(erro.message).not.toContain('html');
  });

  it('4xx sem detalhe legível ainda sai em português', () => {
    const erro = erroDaRespostaDoRag(400, '');

    expect(erro.statusCode).toBe(400);
    expect(erro.message).toBe('Não consegui indexar este conteúdo. Confira o arquivo e envie de novo.');
  });
});

describe('falhaDeIngestao', () => {
  it('mantém o status e a frase quando o erro veio do serviço', () => {
    const falha = falhaDeIngestao(new RagRequestError(415, 'Tipo de arquivo não aceito.'));

    expect(falha).toEqual({ status: 415, mensagem: 'Tipo de arquivo não aceito.' });
  });

  it('erro de rede (serviço fora do ar) vira 503 em português', () => {
    const falha = falhaDeIngestao(new Error('fetch failed'));

    expect(falha.status).toBe(503);
    expect(falha.mensagem).toBe(MENSAGEM_RAG_INDISPONIVEL);
    expect(falha.mensagem).not.toContain('fetch');
  });
});

describe('ehRedeSocial', () => {
  it.each([
    'https://www.instagram.com/conselhomudandoojogo',
    'https://facebook.com/cmj',
    'https://m.facebook.com/cmj',
    'https://www.tiktok.com/@cmj',
    'https://x.com/cmj',
    'https://twitter.com/cmj',
    'https://br.linkedin.com/company/cmj',
    'https://www.youtube.com/@conselhomudandoojogo',
  ])('recusa %s', (url) => {
    expect(ehRedeSocial(url)).toBe(true);
  });

  it.each([
    'https://cmj.com.br/cursos',
    'https://www.zappiq.com.br',
    'https://meufacebook.com.br/blog',
  ])('deixa passar %s', (url) => {
    expect(ehRedeSocial(url)).toBe(false);
  });

  it('a mensagem diz o que fazer em seguida', () => {
    expect(MENSAGEM_REDE_SOCIAL).toBe(
      'Redes sociais não podem ser lidas automaticamente. Cole o texto do perfil ou da publicação.',
    );
  });
});

describe('buildIngestForm', () => {
  it('manda o source estável doc-<id>, e não o título', async () => {
    const { form } = buildIngestForm('org-1', {
      filename: 'Proposta comercial.pdf',
      content: Buffer.from('conteúdo'),
      mimeType: 'application/pdf',
      source: 'doc-ckabc123',
    });

    expect(form.get('source')).toBe('doc-ckabc123');
    expect(form.get('namespace')).toBe('org_org-1');
  });

  it('sem source explícito continua usando o filename (chamadas antigas)', () => {
    const { form } = buildIngestForm('org-1', {
      filename: 'qa-abc.txt',
      content: Buffer.from('x'),
      mimeType: 'text/plain',
    });

    expect(form.get('source')).toBe('qa-abc.txt');
  });

  it('leva título e pergunta na metadata, que viram o cabeçalho de cada trecho', () => {
    const { form } = buildIngestForm('org-1', {
      filename: 'qa-abc.txt',
      content: Buffer.from('x'),
      mimeType: 'text/plain',
      metadata: { titulo: 'Perguntas e respostas', pergunta: 'Vocês dão desconto?' },
    });

    expect(JSON.parse(String(form.get('metadata')))).toEqual({
      titulo: 'Perguntas e respostas',
      pergunta: 'Vocês dão desconto?',
    });
  });

  it('manda a URL de origem, para o serviço aplicar Readability e o portão de conteúdo', () => {
    const { form } = buildIngestForm('org-1', {
      filename: 'cmj.com.br/cursos',
      content: Buffer.from('<html></html>'),
      mimeType: 'text/html',
      sourceUrl: 'https://cmj.com.br/cursos',
    });

    expect(form.get('source_url')).toBe('https://cmj.com.br/cursos');
  });
});
