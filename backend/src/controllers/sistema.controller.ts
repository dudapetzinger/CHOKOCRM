import type { Request, Response } from 'express';
import { agora, dataDeDemonstracao, deslocamentoDias, simulado } from '../lib/relogio';

/**
 * `GET /sistema/relogio`: o relógio do sistema para o front (qualquer papel).
 * O front calcula o próprio "agora" com o deslocamento e mostra a faixa
 * "Data simulada" quando `simulado` (relógio de demonstração, `lib/relogio.ts`).
 */
export function getRelogio(_req: Request, res: Response): void {
  res.status(200).json({
    agora: agora().toISOString(),
    simulado: simulado(),
    dataDeDemonstracao: dataDeDemonstracao(),
    deslocamentoDias: deslocamentoDias(),
  });
}
