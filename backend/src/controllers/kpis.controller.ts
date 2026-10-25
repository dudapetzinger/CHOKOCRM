import type { NextFunction, Request, Response } from 'express';
import { LIMITE_DIAS_DO_PAINEL } from '../config/kpis';
import { periodoQuerySchema } from '../schemas/kpis.schema';
import { representanteEfetivo } from '../services/carteira';
import * as kpisService from '../services/kpis.service';
import { resolverPeriodo } from '../services/periodo';
import { usuarioAutenticado } from './usuarioAutenticado';

export async function getKpis(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = periodoQuerySchema.parse(req.query);
    const usuario = usuarioAutenticado(req);
    const hoje = new Date();
    const janela = resolverPeriodo(query, hoje, { limiteDias: LIMITE_DIAS_DO_PAINEL });

    const kpis = await kpisService.obterKpis(janela, hoje, representanteEfetivo(usuario, query.representanteId));
    res.status(200).json(kpis);
  } catch (err) {
    next(err);
  }
}

export async function getKpisPorRepresentante(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = periodoQuerySchema.parse(req.query);
    const usuario = usuarioAutenticado(req);
    const hoje = new Date();
    const janela = resolverPeriodo(query, hoje, { limiteDias: LIMITE_DIAS_DO_PAINEL });

    const kpis = await kpisService.obterKpisPorRepresentante(
      janela,
      hoje,
      representanteEfetivo(usuario, query.representanteId),
    );
    res.status(200).json(kpis);
  } catch (err) {
    next(err);
  }
}
