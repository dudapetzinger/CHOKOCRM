import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import * as erpService from '../services/erp.service';

const idParamSchema = z.string().uuid('Identificador inválido.');

export async function getErp(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const clientId = idParamSchema.parse(req.params.id);

    const dados = await erpService.obterDadosErp(clientId);
    res.status(200).json(dados);
  } catch (err) {
    next(err);
  }
}
