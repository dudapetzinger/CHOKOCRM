import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { estadoDoRelogio } from '../lib/relogio';
import { credenciaisSchema } from '../schemas/user.schema';
import { recriarDemonstracao } from '../services/demonstracao.service';

/**
 * Rotas de sistema, públicas (a tela de login também as usa):
 * - `GET /sistema/relogio`: o relógio do sistema para o front, `{ agora,
 *   simulado, dataDeDemonstracao, diaDeReferencia, deslocamentoDias }`. O
 *   front calcula o próprio "agora" com o deslocamento e mostra a faixa
 *   "Modo demonstração" quando `simulado` (`lib/relogio.ts`).
 * - `POST /sistema/demonstracao` `{ data: 'AAAA-MM-DD' | null, usuario, senha }`:
 *   com a senha da conta Gestão, liga (ou desliga, com `null`) o modo
 *   demonstração e recria a demonstração nessa data
 *   (`demonstracao.service.ts`); responde `{ relogio }`, o mesmo do GET.
 */
const demonstracaoSchema = credenciaisSchema.extend({
  data: z.iso.date({ error: 'Data da demonstração inválida.' }).nullable(),
});

export function getRelogio(_req: Request, res: Response): void {
  res.status(200).json(estadoDoRelogio());
}

export async function postDemonstracao(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { data, usuario, senha } = demonstracaoSchema.parse(req.body);
    const relogio = await recriarDemonstracao(data, usuario, senha);
    res.status(200).json({ relogio });
  } catch (err) {
    next(err);
  }
}
