import type { Role } from '@prisma/client';
import type { Request } from 'express';
import { AppError } from '../errors/AppError';
import { ErrorCode } from '../errors/errorCodes';

const MENSAGEM_SEM_USUARIO = 'Token de autenticação ausente ou inválido.';

/** `authJwt` popula `req.user`; esta guarda estreita o tipo sem asserção. */
export function usuarioAutenticado(req: Request): { id: string; role: Role } {
  if (!req.user) {
    throw new AppError(ErrorCode.UNAUTHORIZED, MENSAGEM_SEM_USUARIO, 401);
  }

  return req.user;
}
