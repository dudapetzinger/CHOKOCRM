import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { alertasQuerySchema, horizonteQuerySchema } from '../schemas/insights.schema';
import { representanteEfetivo } from '../services/carteira';
import * as insightsService from '../services/insights.service';
import { usuarioAutenticado } from './usuarioAutenticado';

const idParamSchema = z.string().uuid('Identificador inválido.');

export async function getInsightsDoCliente(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const clientId = idParamSchema.parse(req.params.id);
    const { horizonteDias } = horizonteQuerySchema.parse(req.query);
    const usuario = usuarioAutenticado(req);

    const insights = await insightsService.obterInsights(clientId, usuario, horizonteDias);
    res.status(200).json(insights);
  } catch (err) {
    next(err);
  }
}

export async function getAlertasDeProducao(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { horizonteDias, representanteId } = alertasQuerySchema.parse(req.query);
    const usuario = usuarioAutenticado(req);

    const alertas = await insightsService.obterAlertasDeProducao(
      horizonteDias,
      new Date(),
      representanteEfetivo(usuario, representanteId),
    );
    res.status(200).json(alertas);
  } catch (err) {
    next(err);
  }
}
