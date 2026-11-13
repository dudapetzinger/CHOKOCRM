import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import * as stockMessageService from '../services/stock-message.service';
import { usuarioAutenticado } from './usuarioAutenticado';

const idParamSchema = z.string().uuid('Identificador inválido.');

/** `GET /clients/:id/stock-message/proposta`: monta a mensagem sugerida e não grava nada. */
export async function getProposta(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const clientId = idParamSchema.parse(req.params.id);
    const usuario = usuarioAutenticado(req);

    const proposta = await stockMessageService.propor(clientId, usuario);
    res.status(200).json(proposta);
  } catch (err) {
    next(err);
  }
}
