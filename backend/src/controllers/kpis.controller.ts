import type { NextFunction, Request, Response } from 'express';
import { periodoQuerySchema } from '../schemas/kpis.schema';
import * as kpisService from '../services/kpis.service';

export async function getKpis(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { periodoDias } = periodoQuerySchema.parse(req.query);

    const kpis = await kpisService.obterKpis(periodoDias);
    res.status(200).json(kpis);
  } catch (err) {
    next(err);
  }
}
