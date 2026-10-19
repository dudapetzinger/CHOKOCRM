import { Router } from 'express';
import { getProdutos } from '../controllers/produtos.controller';
import { authJwt } from '../middlewares/authJwt';

/**
 * Catálogo de produtos do ERP, montado em `/erp` (`GET /erp/produtos`).
 * Qualquer usuário autenticado lê: o representante monta o pedido do
 * check-in com ele (spec 7.5).
 */
export const produtosRouter = Router();

produtosRouter.use(authJwt);
produtosRouter.get('/produtos', getProdutos);
