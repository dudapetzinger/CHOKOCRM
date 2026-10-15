import type { NextFunction, Request, Response } from 'express';
import { periodoQuerySchema } from '../schemas/kpis.schema';
import { representanteEfetivo } from '../services/carteira';
import * as kpisService from '../services/kpis.service';
import { usuarioAutenticado } from './usuarioAutenticado';

export async function getKpis(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { periodoDias, representanteId } = periodoQuerySchema.parse(req.query);
    const usuario = usuarioAutenticado(req);

    const kpis = await kpisService.obterKpis(periodoDias, new Date(), representanteEfetivo(usuario, representanteId));
    res.status(200).json(kpis);
  } catch (err) {
    next(err);
  }
}
