import { Router } from 'express';
import { getAgendaToday } from '../controllers/agenda.controller';
import { authJwt } from '../middlewares/authJwt';

/** UC10: agenda do dia (visitas atrasadas e previstas para hoje). */
export const agendaRouter = Router();

agendaRouter.use(authJwt);
agendaRouter.get('/today', getAgendaToday);
