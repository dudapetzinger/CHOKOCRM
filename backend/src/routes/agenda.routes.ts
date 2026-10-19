import { Router } from 'express';
import { getAgendaCalendario, getAgendaToday } from '../controllers/agenda.controller';
import { authJwt } from '../middlewares/authJwt';

/** UC10: agenda do dia (visitas atrasadas e previstas para hoje) e o calendário do mês (spec 7.6). */
export const agendaRouter = Router();

// Autenticação por rota (e não `agendaRouter.use`): `/agenda` também é uma
// rota do frontend, e a navegação do browser até ela precisa seguir para o
// fallback da SPA (ver `app.ts`) em vez de receber 401.
agendaRouter.get('/today', authJwt, getAgendaToday);
agendaRouter.get('/calendario', authJwt, getAgendaCalendario);
