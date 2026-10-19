import type { NextFunction, Request, Response } from 'express';
import { periodoQuerySchema } from '../schemas/kpis.schema';
import { representanteEfetivo } from '../services/carteira';
import * as relatorioService from '../services/relatorio.service';
import { usuarioAutenticado } from './usuarioAutenticado';

/** Relatório da planilha do Painel (spec 7.12): mesmo período e mesma carteira dos indicadores. */
export async function getRelatorio(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { periodoDias, representanteId } = periodoQuerySchema.parse(req.query);
    const usuario = usuarioAutenticado(req);

    const linhas = await relatorioService.obterRelatorio(
      periodoDias,
      new Date(),
      representanteEfetivo(usuario, representanteId),
    );
    res.status(200).json({ data: linhas });
  } catch (err) {
    next(err);
  }
}
