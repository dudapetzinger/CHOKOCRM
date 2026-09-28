import type { Role } from '@prisma/client';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { AppError } from '../errors/AppError';
import { ErrorCode } from '../errors/errorCodes';
import { updateRecurrenceSchema } from '../schemas/recurrence.schema';
import * as recurrenceService from '../services/recurrence.service';

const idParamSchema = z.string().uuid('Identificador inválido.');

const MENSAGEM_SEM_USUARIO = 'Token de autenticação ausente ou inválido.';

/** `authJwt` popula `req.user`; esta guarda estreita o tipo sem asserção. */
function usuarioAutenticado(req: Request): { id: string; role: Role } {
  if (!req.user) {
    throw new AppError(ErrorCode.UNAUTHORIZED, MENSAGEM_SEM_USUARIO, 401);
  }

  return req.user;
}

export async function putRecurrence(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const clientId = idParamSchema.parse(req.params.id);
    const input = updateRecurrenceSchema.parse(req.body);
    const usuario = usuarioAutenticado(req);

    const cliente = await recurrenceService.alterarRecorrencia(clientId, usuario.id, input);
    res.status(200).json(cliente);
  } catch (err) {
    next(err);
  }
}
