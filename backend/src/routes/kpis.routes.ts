import { Router } from 'express';
import { getKpis, getKpisPorRepresentante } from '../controllers/kpis.controller';
import { getVendasMensais } from '../controllers/vendas-mensais.controller';
import { authJwt } from '../middlewares/authJwt';
import { requireRole } from '../middlewares/requireRole';

/**
 * Router montado em `/dashboard`. Os indicadores do painel (UC14), o
 * comparativo por representante e as vendas mensais consolidam visitas,
 * mensagens, clientes e vendas de toda a carteira e são exclusivos do gestor.
 */
export const dashboardRouter = Router();

dashboardRouter.use(authJwt);
dashboardRouter.get('/kpis', requireRole('GESTOR'), getKpis);
dashboardRouter.get('/kpis/por-representante', requireRole('GESTOR'), getKpisPorRepresentante);
dashboardRouter.get('/vendas-mensais', requireRole('GESTOR'), getVendasMensais);
