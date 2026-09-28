import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { updateRecurrenceSchema } from '../schemas/recurrence.schema';
import * as recurrenceService from '../services/recurrence.service';
import { usuarioAutenticado } from './usuarioAutenticado';

const idParamSchema = z.string().uuid('Identificador inválido.');

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
