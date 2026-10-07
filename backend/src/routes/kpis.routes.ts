import { Router } from 'express';
import { getKpis } from '../controllers/kpis.controller';
import { authJwt } from '../middlewares/authJwt';
import { requireRole } from '../middlewares/requireRole';

/**
 * Router montado em `/dashboard`. Os indicadores do painel (UC14) consolidam
 * visitas, mensagens e clientes de toda a carteira e são exclusivos do gestor.
 */
export const dashboardRouter = Router();

dashboardRouter.use(authJwt);
dashboardRouter.get('/kpis', requireRole('GESTOR'), getKpis);
