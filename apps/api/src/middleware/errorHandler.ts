import { Request, Response, NextFunction } from 'express';
import { MulterError } from 'multer';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';
import { MAX_UPLOAD_MB } from '../config/upload.js';

export interface AppError extends Error {
  statusCode?: number;
  status?: number;
  code?: string; // Prisma error code
}

/**
 * Tipo de arquivo recusado antes de sair do processo.
 *
 * A lista de formatos é a que o serviço de indexação realmente lê. Word e
 * Excel entraram nela em 14/09/2026, junto com os conversores (mammoth e
 * openpyxl) em services/rag/extractors.py: até ali a tela prometia os dois, o
 * indexador devolvia 415 e o cliente ficava sem entender por que o arquivo
 * sumiu (achado A003). Se um formato sair de lá, tem de sair daqui também.
 */
export class UnsupportedFileTypeError extends Error {
  statusCode = 415;

  constructor(
    message = 'Tipo de arquivo não aceito: envie PDF, Word (.docx), Excel (.xlsx), texto, Markdown ou CSV.',
  ) {
    super(message);
    this.name = 'UnsupportedFileTypeError';
  }
}

const MULTER_MENSAGENS: Record<string, string> = {
  LIMIT_PART_COUNT: 'o formulário tem partes demais.',
  LIMIT_FILE_COUNT: 'mais de um arquivo por envio.',
  LIMIT_FIELD_KEY: 'nome de campo longo demais.',
  LIMIT_FIELD_VALUE: 'valor de campo longo demais.',
  LIMIT_FIELD_COUNT: 'campos demais no formulário.',
  LIMIT_UNEXPECTED_FILE: 'campo de arquivo inesperado.',
  MISSING_FIELD_NAME: 'o campo do arquivo veio sem nome.',
  LIMIT_FIELD_NESTING: 'nome de campo aninhado demais.',
  LIMIT_FIELD_ARRAY_INDEX: 'índice de campo grande demais.',
  STREAM_DESTROYED: 'o envio foi interrompido antes de terminar.',
  INVALID_FIELD_NAME: 'nome de campo inválido.',
};

/**
 * Traduz um erro do multer para a resposta que o cliente lê.
 *
 * Sem isto, qualquer envio malformado caía no ramo genérico e virava 500 com
 * "Internal Server Error" em produção: o cliente via bug da plataforma onde
 * havia só um limite de tamanho.
 */
function respostaDoMulter(err: AppError): { statusCode: number; message: string } | null {
  if (!(err instanceof MulterError)) return null;

  if (err.code === 'LIMIT_FILE_SIZE') {
    // O número sai da MESMA constante que o multer usa para cortar o envio. Se
    // alguém apertar o limite, a mensagem acompanha sozinha.
    return {
      statusCode: 413,
      message: `Arquivo maior que ${MAX_UPLOAD_MB} MB. Divida o arquivo ou envie um menor.`,
    };
  }

  const detalhe = MULTER_MENSAGENS[err.code] ?? 'o formato do envio não foi aceito.';
  return { statusCode: 400, message: `Envio inválido: ${detalhe}` };
}

// Sanitize Prisma/internal errors to prevent information leakage
function sanitizeErrorMessage(err: AppError): string {
  if (env.NODE_ENV !== 'production') return err.message || 'Internal Server Error';

  // Prisma errors — never expose schema details in production
  if (err.code?.startsWith('P')) return 'Database operation failed';

  // Generic 500 errors — hide internals
  const statusCode = err.statusCode || err.status || 500;
  if (statusCode >= 500) return 'Internal Server Error';

  // Client errors (4xx) — safe to return as-is
  return err.message || 'Request failed';
}

export function errorHandler(err: AppError, req: Request, res: Response, _next: NextFunction): void {
  const doMulter = respostaDoMulter(err);
  const statusCode = doMulter?.statusCode ?? err.statusCode ?? err.status ?? 500;
  const safeMessage = doMulter?.message ?? sanitizeErrorMessage(err);

  logger.error({
    message: err.message, // full message in logs only
    statusCode,
    path: req.path,
    method: req.method,
    organizationId: req.organizationId,
    ...(err.code && { prismaCode: err.code }),
    stack: err.stack,
  });

  const body: Record<string, any> = {
    error: safeMessage,
    status: statusCode,
  };

  if (env.NODE_ENV !== 'production') {
    body.stack = err.stack;
  }

  res.status(statusCode).json(body);
}
