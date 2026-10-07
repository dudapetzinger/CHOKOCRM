import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { horizonteQuerySchema } from '../schemas/insights.schema';
import * as insightsService from '../services/insights.service';

const idParamSchema = z.string().uuid('Identificador inválido.');

export async function getInsightsDoCliente(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const clientId = idParamSchema.parse(req.params.id);
    const { horizonteDias } = horizonteQuerySchema.parse(req.query);

    const insights = await insightsService.obterInsights(clientId, horizonteDias);
    res.status(200).json(insights);
  } catch (err) {
    next(err);
  }
}

export async function getAlertasDeProducao(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { horizonteDias } = horizonteQuerySchema.parse(req.query);

    const alertas = await insightsService.obterAlertasDeProducao(horizonteDias);
    res.status(200).json(alertas);
  } catch (err) {
    next(err);
  }
}
