import winston from 'winston';
import { trace, context } from '@opentelemetry/api';
import { env } from '../config/env.js';

const { combine, timestamp, colorize, printf, json } = winston.format;

/**
 * Enriquece cada log com traceId / spanId do OTel ativo.
 * Permite correlacionar logs <-> traces no Grafana/Tempo.
 */
const otelContext = winston.format((info) => {
  const span = trace.getSpan(context.active());
  if (span) {
    const ctx = span.spanContext();
    info.traceId = ctx.traceId;
    info.spanId = ctx.spanId;
  }
  return info;
});

const devFormat = combine(
  otelContext(),
  colorize(),
  timestamp({ format: 'HH:mm:ss' }),
  printf(({ timestamp, level, message, traceId, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    const traceTag = traceId ? ` [trace=${String(traceId).slice(0, 8)}]` : '';
    return `${timestamp} ${level}${traceTag}: ${message}${metaStr}`;
  }),
);

const prodFormat = combine(otelContext(), timestamp(), json());

export const logger = winston.createLogger({
  level: env.NODE_ENV === 'development' ? 'debug' : 'info',
  format: env.NODE_ENV === 'development' ? devFormat : prodFormat,
  defaultMeta: {
    service: 'zappiq-api',
    env: env.NODE_ENV,
  },
  transports: [new winston.transports.Console()],
});
