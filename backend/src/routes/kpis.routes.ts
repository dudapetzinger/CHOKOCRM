import { Router } from 'express';
import { getKpis, getKpisPorRepresentante } from '../controllers/kpis.controller';
import { getRelatorio } from '../controllers/relatorio.controller';
import { getVendasMensais } from '../controllers/vendas-mensais.controller';
import { authJwt } from '../middlewares/authJwt';

/**
 * Router montado em `/dashboard`: os indicadores do painel (UC14), o
 * comparativo por representante, as vendas mensais e o relatório da
 * planilha (Etapa 8, spec 7.10 e 7.12). Qualquer usuário autenticado lê,
 * sem `requireRole`: cada controller passa por `representanteEfetivo`, que
 * prende o representante à própria carteira (o `representanteId` que ele
 * mandar é ignorado); o gestor vê a empresa toda ou a carteira escolhida.
 */
export const dashboardRouter = Router();

dashboardRouter.use(authJwt);
dashboardRouter.get('/kpis', getKpis);
dashboardRouter.get('/kpis/por-representante', getKpisPorRepresentante);
dashboardRouter.get('/vendas-mensais', getVendasMensais);
dashboardRouter.get('/relatorio', getRelatorio);
