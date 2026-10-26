import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import * as reminderService from '../services/reminder.service';
import { usuarioAutenticado } from './usuarioAutenticado';

/** Lembretes do cliente (Etapa 9): a lista dos abertos na ficha e o "Concluir". */

const idParamSchema = z.string().uuid('Identificador inválido.');

export async function getLembretesDoCliente(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const clientId = idParamSchema.parse(req.params.id);
    const data = await reminderService.listarAbertosDoCliente(clientId, usuarioAutenticado(req));
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function patchConcluirLembrete(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = idParamSchema.parse(req.params.id);
    const concluido = await reminderService.concluir(id, usuarioAutenticado(req));
    res.status(200).json(concluido);
  } catch (err) {
    next(err);
  }
}
