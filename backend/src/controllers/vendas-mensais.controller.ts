import type { NextFunction, Request, Response } from 'express';
import { LIMITE_DIAS_DO_PAINEL } from '../config/kpis';
import { vendasMensaisQuerySchema } from '../schemas/kpis.schema';
import { representanteEfetivo } from '../services/carteira';
import { resolverPeriodo } from '../services/periodo';
import * as vendasMensaisService from '../services/vendas-mensais.service';
import { usuarioAutenticado } from './usuarioAutenticado';

export async function getVendasMensais(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = vendasMensaisQuerySchema.parse(req.query);
    const usuario = usuarioAutenticado(req);
    const hoje = new Date();
    const janela = resolverPeriodo(query, hoje, { limiteDias: LIMITE_DIAS_DO_PAINEL });

    const vendas = await vendasMensaisService.obterVendasMensais(
      janela,
      hoje,
      representanteEfetivo(usuario, query.representanteId),
    );
    res.status(200).json(vendas);
  } catch (err) {
    next(err);
  }
}
