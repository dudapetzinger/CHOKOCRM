import type { Role } from '@prisma/client';
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AppError } from '../errors/AppError';
import { ErrorCode } from '../errors/errorCodes';

const MENSAGEM_TOKEN_INVALIDO = 'Token de autenticação ausente ou inválido.';
const ROLES_VALIDOS: Role[] = ['REPRESENTANTE', 'GESTOR'];

function extrairToken(header: string | undefined): string | null {
  if (!header) return null;
  const [esquema, token] = header.split(' ');
  if (esquema !== 'Bearer' || !token) return null;
  return token;
}

function ehRoleValido(role: unknown): role is Role {
  return typeof role === 'string' && (ROLES_VALIDOS as string[]).includes(role);
}

/**
 * Exige um JWT válido no header `Authorization: Bearer <token>`. Em caso de
 * sucesso, popula `req.user = { id, role }` (payload assinado em
 * `auth.service.ts` como `{ sub, role }`); caso contrário, 401 UNAUTHORIZED.
 */
export function authJwt(req: Request, _res: Response, next: NextFunction): void {
  const token = extrairToken(req.headers.authorization);

  if (!token) {
    next(new AppError(ErrorCode.UNAUTHORIZED, MENSAGEM_TOKEN_INVALIDO, 401));
    return;
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET);

    if (typeof payload === 'string' || typeof payload.sub !== 'string' || !ehRoleValido(payload.role)) {
      next(new AppError(ErrorCode.UNAUTHORIZED, MENSAGEM_TOKEN_INVALIDO, 401));
      return;
    }

    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch {
    next(new AppError(ErrorCode.UNAUTHORIZED, MENSAGEM_TOKEN_INVALIDO, 401));
  }
}
