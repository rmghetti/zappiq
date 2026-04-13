import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';

export interface AppError extends Error {
  statusCode?: number;
  status?: number;
  code?: string; // Prisma error code
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
  const statusCode = err.statusCode || err.status || 500;
  const safeMessage = sanitizeErrorMessage(err);

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
