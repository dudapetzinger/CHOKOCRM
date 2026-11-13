import { Router } from 'express';
import { getProdutos } from '../controllers/produtos.controller';
import { authJwt } from '../middlewares/authJwt';

/**
 * Leitura do ERP aberta a qualquer usuário autenticado, montada em `/erp`: o
 * catálogo de produtos (`GET /erp/produtos`), com que o representante monta o
 * pedido do check-in. As rotas só do gestor (importação de notas) ficam em
 * `importacao.routes.ts`.
 */
export const produtosRouter = Router();

produtosRouter.use(authJwt);
produtosRouter.get('/produtos', getProdutos);
