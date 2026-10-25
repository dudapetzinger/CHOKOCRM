import type { NextFunction, Request, Response } from 'express';
import { periodoQuerySchema } from '../schemas/kpis.schema';
import { representanteEfetivo } from '../services/carteira';
import { resolverPeriodo } from '../services/periodo';
import * as relatorioService from '../services/relatorio.service';
import { usuarioAutenticado } from './usuarioAutenticado';

/** Relatório da planilha do Painel (spec 7.12): mesmo período e mesma carteira dos indicadores. */
export async function getRelatorio(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = periodoQuerySchema.parse(req.query);
    const usuario = usuarioAutenticado(req);
    const hoje = new Date();
    // Sem teto de dias: a Planilha é onde se vê além do limite do Painel.
    const janela = resolverPeriodo(query, hoje);

    const linhas = await relatorioService.obterRelatorio(
      janela,
      hoje,
      representanteEfetivo(usuario, query.representanteId),
    );
    res.status(200).json({ data: linhas });
  } catch (err) {
    next(err);
  }
}
