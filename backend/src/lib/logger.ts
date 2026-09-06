import pino from 'pino';
import { env } from '../config/env';

/**
 * Instância única de logger (pino), compartilhada pelo requestLogger e pelo errorHandler.
 * Em desenvolvimento usa formatação legível (pino-pretty); em teste fica silenciosa
 * para não poluir a saída do Jest; em produção emite JSON estruturado.
 */
export const logger = pino({
  level: env.NODE_ENV === 'test' ? 'silent' : 'info',
  transport:
    env.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
});
