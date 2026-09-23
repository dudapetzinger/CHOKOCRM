import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../errors/AppError';
import { ErrorCode } from '../errors/errorCodes';
import { logger } from '../lib/logger';

/**
 * Middleware central de tratamento de erros. Converte:
 * - AppError -> statusCode/formato próprio do erro;
 * - ZodError -> 400 VALIDATION_ERROR com os detalhes de cada issue;
 * - corpo acima do limite do parser -> 413 PAYLOAD_TOO_LARGE;
 * - qualquer outro erro -> 500 INTERNAL, com o erro completo logado via pino.
 * Sempre no formato { error: { code, message, details? } }.
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details !== undefined ? { details: err.details } : {}),
      },
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Dados inválidos.',
        details: err.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      },
    });
    return;
  }

  // `express.raw`/`express.json` levantam um erro com `type` próprio quando
  // o corpo excede o limite configurado. Sem esta tradução, o cliente
  // receberia 500 ao enviar uma foto grande demais.
  if (typeof err === 'object' && err !== null && (err as { type?: string }).type === 'entity.too.large') {
    res.status(413).json({
      error: {
        code: ErrorCode.PAYLOAD_TOO_LARGE,
        message: 'A foto excede o limite de 5 MB.',
      },
    });
    return;
  }

  logger.error({ err }, 'Erro não tratado');
  res.status(500).json({
    error: {
      code: ErrorCode.INTERNAL,
      message: 'Erro interno do servidor.',
    },
  });
};
