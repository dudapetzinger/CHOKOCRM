import type { Role } from '@prisma/client';
import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../errors/AppError';
import { ErrorCode } from '../errors/errorCodes';

const MENSAGEM_ACESSO_NEGADO = 'Você não tem permissão para acessar este recurso.';

/**
 * Exige que `req.user` (populado por `authJwt`) tenha o papel informado;
 * caso contrário, 403 FORBIDDEN. Deve ser usado sempre depois de `authJwt`.
 */
export function requireRole(role: Role) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (req.user?.role !== role) {
      next(new AppError(ErrorCode.FORBIDDEN, MENSAGEM_ACESSO_NEGADO, 403));
      return;
    }

    next();
  };
}
