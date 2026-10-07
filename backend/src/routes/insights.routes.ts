import { Router } from 'express';
import { getAlertasDeProducao, getInsightsDoCliente } from '../controllers/insights.controller';
import { authJwt } from '../middlewares/authJwt';
import { requireRole } from '../middlewares/requireRole';

/**
 * Router aninhado sob `/clients/:id/insights` (montado com `mergeParams` para
 * enxergar o `:id` do cliente definido no prefixo do app.ts). Os insights
 * sazonais do cliente (UC13) são acessíveis a qualquer usuário autenticado
 * (representante ou gestor), sem `requireRole`.
 */
export const clientInsightsRouter = Router({ mergeParams: true });

clientInsightsRouter.use(authJwt);
clientInsightsRouter.get('/', getInsightsDoCliente);

/**
 * Router montado em `/insights`. Os alertas de produção (UC15) cruzam o
 * estoque de todos os clientes e são exclusivos do gestor.
 */
export const insightsRouter = Router();

insightsRouter.use(authJwt);
insightsRouter.get('/manager-alerts', requireRole('GESTOR'), getAlertasDeProducao);
