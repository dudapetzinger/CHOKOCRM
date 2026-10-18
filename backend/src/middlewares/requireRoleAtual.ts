import type { Role } from '@prisma/client';
import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../errors/AppError';
import { ErrorCode } from '../errors/errorCodes';
import { findById } from '../repositories/user.repository';

const MENSAGEM_ACESSO_NEGADO = 'Você não tem permissão para acessar este recurso.';

/**
 * Como `requireRole`, mas confere no banco: o autor ainda existe, está
 * ativo e tem o papel exigido. O JWT vale até 8 h com o papel do momento do
 * login; sem esta checagem, um gestor inativado ou rebaixado continuaria
 * agindo como gestor até o token vencer — e poderia, por exemplo, se
 * reativar ou criar outra conta de gestor. Usado depois de `authJwt` e
 * `requireRole` nas rotas que mexem em contas (`/users`).
 */
export function requireRoleAtual(role: Role) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const autor = req.user ? await findById(req.user.id) : null;

      if (!autor || !autor.ativo || autor.role !== role) {
        next(new AppError(ErrorCode.FORBIDDEN, MENSAGEM_ACESSO_NEGADO, 403));
        return;
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
