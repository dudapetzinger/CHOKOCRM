import { Router } from 'express';
import { getSituacao } from '../controllers/erp.controller';
import { getProdutos } from '../controllers/produtos.controller';
import { authJwt } from '../middlewares/authJwt';

/**
 * Leituras do ERP abertas a qualquer usuário autenticado, montadas em `/erp`:
 * o catálogo de produtos (`GET /erp/produtos`), com que o representante monta
 * o pedido do check-in (spec 7.5), e a situação da fonte de vendas
 * (`GET /erp/situacao`, Etapa 12b), para os avisos das telas. As rotas só do
 * gestor (importação de notas) ficam em `importacao.routes.ts`.
 */
export const produtosRouter = Router();

produtosRouter.use(authJwt);
produtosRouter.get('/produtos', getProdutos);
produtosRouter.get('/situacao', getSituacao);
