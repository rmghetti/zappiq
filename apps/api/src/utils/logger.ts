import winston from 'winston';
import { env } from '../config/env.js';

const { combine, timestamp, colorize, printf, json } = winston.format;

const devFormat = combine(
    colorize(),
    timestamp({ format: 'HH:mm:ss' }),
    printf(({ timestamp, level, message, ...meta }) => {
          const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
          return `${timestamp} ${level}: ${message}${metaStr}`;
    })
  );

const prodFormat = combine(timestamp(), json());

export const logger = winston.createLogger({
    level: env.NODE_ENV === 'development' ? 'debug' : 'info',
    format: env.NODE_ENV === 'development' ? devFormat : prodFormat,
    transports: [new winston.transports.Console()],
});
