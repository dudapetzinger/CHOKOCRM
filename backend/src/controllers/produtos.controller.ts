import type { NextFunction, Request, Response } from 'express';
import * as erpService from '../services/erp.service';

export async function getProdutos(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json({ data: erpService.listarProdutos() });
  } catch (err) {
    next(err);
  }
}
