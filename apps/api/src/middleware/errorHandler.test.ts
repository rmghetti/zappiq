/**
 * errorHandler: o que o cliente lê quando o envio dá errado.
 *
 * Antes deste teste, qualquer erro do multer (arquivo grande demais, campo
 * inesperado, tipo recusado) caía no ramo genérico e virava 500 com
 * "Internal Server Error" em produção. Para quem está treinando a IA, um
 * arquivo de 30 MB parecia bug da plataforma, e não um limite.
 *
 * Tudo aqui roda com NODE_ENV de produção de propósito: é o ambiente em que a
 * mensagem corre risco de ser apagada pelo saneamento.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import { MulterError } from 'multer';

vi.mock('../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../config/env.js', () => ({
  env: { NODE_ENV: 'production' },
}));

const { errorHandler, UnsupportedFileTypeError } = await import('./errorHandler.js');

function fakeRes() {
  const captured: { status?: number; body?: any } = {};
  const res = {
    status(code: number) {
      captured.status = code;
      return res;
    },
    json(body: any) {
      captured.body = body;
      return res;
    },
  } as unknown as Response;
  return { res, captured };
}

const req = { path: '/api/ai-training/documents', method: 'POST' } as unknown as Request;

function run(err: any) {
  const { res, captured } = fakeRes();
  errorHandler(err, req, res, vi.fn());
  return captured;
}

beforeEach(() => vi.clearAllMocks());

describe('errorHandler, erros de upload do multer', () => {
  it('arquivo acima do limite vira 413 com a explicação do limite', () => {
    const out = run(new MulterError('LIMIT_FILE_SIZE', 'file'));

    expect(out.status).toBe(413);
    expect(out.body.error).toBe('Arquivo maior que 20 MB. Divida o arquivo ou envie um menor.');
  });

  it('demais erros do multer viram 400 em português, sem vazar o código cru', () => {
    const out = run(new MulterError('LIMIT_UNEXPECTED_FILE', 'arquivo'));

    expect(out.status).toBe(400);
    expect(out.body.error).toBe('Envio inválido: campo de arquivo inesperado.');
    expect(out.body.error).not.toContain('LIMIT_UNEXPECTED_FILE');
  });

  it('erro do multer sem tradução conhecida ainda sai como 400 em português', () => {
    const out = run(new MulterError('LIMIT_PART_COUNT', 'file'));

    expect(out.status).toBe(400);
    expect(out.body.error).toMatch(/^Envio inválido: /);
    expect(out.body.error).not.toContain('LIMIT_PART_COUNT');
  });
});

describe('UnsupportedFileTypeError', () => {
  it('vira 415 com a lista de formatos que a plataforma aceita hoje', () => {
    const out = run(new UnsupportedFileTypeError());

    expect(out.status).toBe(415);
    expect(out.body.error).toBe(
      'Tipo de arquivo não suportado: envie PDF, TXT, MD ou CSV.',
    );
  });

  it('carrega statusCode 415 para quem inspecionar o erro fora do handler', () => {
    expect(new UnsupportedFileTypeError().statusCode).toBe(415);
  });
});

describe('errorHandler, o que já valia continua valendo', () => {
  it('erro genérico em produção não vaza detalhe interno', () => {
    const out = run(new Error('connect ECONNREFUSED 10.0.0.7:5432 senha do pooler'));

    expect(out.status).toBe(500);
    expect(out.body.error).toBe('Internal Server Error');
    expect(JSON.stringify(out.body)).not.toContain('ECONNREFUSED');
  });

  it('erro 4xx de negócio continua chegando ao cliente em produção', () => {
    const err: any = new Error('Arquivo ausente (campo "file" obrigatório)');
    err.statusCode = 400;

    const out = run(err);

    expect(out.status).toBe(400);
    expect(out.body.error).toBe('Arquivo ausente (campo "file" obrigatório)');
  });
});
