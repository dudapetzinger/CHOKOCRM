import { Router } from 'express';
import { getProdutos } from '../controllers/produtos.controller';
import { authJwt } from '../middlewares/authJwt';

/**
 * Leitura do ERP aberta a qualquer usuário autenticado, montada em `/erp`: o
 * catálogo de produtos (`GET /erp/produtos`), de onde a tela de Campanhas
 * tira os produtos em destaque. O check-in não leva produtos: eles chegam
 * pela nota fiscal vinculada à visita. As rotas só do gestor (importação de
 * notas) ficam em `importacao.routes.ts`.
 */
export const produtosRouter = Router();

produtosRouter.use(authJwt);
produtosRouter.get('/produtos', getProdutos);
