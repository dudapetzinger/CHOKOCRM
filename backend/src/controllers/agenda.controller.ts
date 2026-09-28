import type { NextFunction, Request, Response } from 'express';
import { getAgendaDoDia } from '../services/agenda.service';
import { usuarioAutenticado } from './usuarioAutenticado';

export async function getAgendaToday(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const usuario = usuarioAutenticado(req);
    const data = await getAgendaDoDia(usuario);
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}
