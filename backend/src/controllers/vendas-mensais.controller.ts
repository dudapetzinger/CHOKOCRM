import type { NextFunction, Request, Response } from 'express';
import { vendasMensaisQuerySchema } from '../schemas/kpis.schema';
import { representanteEfetivo } from '../services/carteira';
import * as vendasMensaisService from '../services/vendas-mensais.service';
import { usuarioAutenticado } from './usuarioAutenticado';

export async function getVendasMensais(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { representanteId } = vendasMensaisQuerySchema.parse(req.query);
    const usuario = usuarioAutenticado(req);

    const vendas = await vendasMensaisService.obterVendasMensais(
      new Date(),
      representanteEfetivo(usuario, representanteId),
    );
    res.status(200).json(vendas);
  } catch (err) {
    next(err);
  }
}
