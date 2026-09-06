import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../errors/AppError';
import { ErrorCode } from '../errors/errorCodes';
import { logger } from '../lib/logger';
import { prisma } from '../lib/prisma';

export async function getHealth(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: 'ok', db: 'ok' });
  } catch (err) {
    logger.error({ err }, 'Falha na verificação de saúde do banco de dados');
    next(new AppError(ErrorCode.SERVICE_UNAVAILABLE, 'Serviço indisponível: banco de dados inacessível.', 503));
  }
}
