import type { NextFunction, Request, Response } from 'express';
import { agendaQuerySchema } from '../schemas/agenda.schema';
import { getAgendaDoDia } from '../services/agenda.service';
import { usuarioAutenticado } from './usuarioAutenticado';

export async function getAgendaToday(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { representanteId } = agendaQuerySchema.parse(req.query);
    const usuario = usuarioAutenticado(req);
    const data = await getAgendaDoDia(usuario, new Date(), representanteId);
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}
