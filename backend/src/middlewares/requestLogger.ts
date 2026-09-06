import pinoHttp from 'pino-http';
import { logger } from '../lib/logger';

/**
 * Redação de headers sensíveis nos logs de requisição: o header
 * `Authorization` carrega o JWT em texto plano (válido por até
 * `JWT_EXPIRES_IN`) e `Cookie` poderia carregar sessão/CSRF no futuro —
 * nenhum dos dois deve ficar retido em agregadores de log.
 */
export const requestLogger = pinoHttp({
  logger,
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie'],
    censor: '[REDACTED]',
  },
});
