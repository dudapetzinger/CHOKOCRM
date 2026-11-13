import { Router } from 'express';
import { getAlertasDeProducao, getInsightsDoCliente } from '../controllers/insights.controller';
import { authJwt } from '../middlewares/authJwt';

/**
 * Router aninhado sob `/clients/:id/insights` (montado com `mergeParams` para
 * enxergar o `:id` do cliente definido no prefixo do app.ts). Os insights
 * sazonais do cliente são acessíveis a qualquer usuário autenticado
 * (representante ou gestor), sem `requireRole`.
 */
export const clientInsightsRouter = Router({ mergeParams: true });

clientInsightsRouter.use(authJwt);
clientInsightsRouter.get('/', getInsightsDoCliente);

/**
 * Router montado em `/insights`. Os alertas de produção cruzam o
 * estoque dos clientes da carteira: o gestor vê todos ou os do
 * representante escolhido; o representante (no Painel dele) só os
 * da própria carteira, via `representanteEfetivo` no controller.
 */
export const insightsRouter = Router();

insightsRouter.use(authJwt);
insightsRouter.get('/manager-alerts', getAlertasDeProducao);
