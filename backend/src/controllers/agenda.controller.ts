import type { NextFunction, Request, Response } from 'express';
import { agendaQuerySchema, calendarioQuerySchema } from '../schemas/agenda.schema';
import { getAgendaDoDia, getCalendario } from '../services/agenda.service';
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

export async function getAgendaCalendario(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { mes, representanteId } = calendarioQuerySchema.parse(req.query);
    const usuario = usuarioAutenticado(req);
    const data = await getCalendario(usuario, mes, new Date(), representanteId);
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}
