import { Router } from 'express';
import { getErp } from '../controllers/erp.controller';
import { authJwt } from '../middlewares/authJwt';

/**
 * Router aninhado sob `/clients/:id/erp` (montado com `mergeParams` para
 * enxergar o `:id` do cliente definido no prefixo do app.ts). Consulta de
 * venda/estoque no ERP (UC11) é acessível a qualquer usuário autenticado
 * (representante ou gestor), sem `requireRole`.
 */
export const erpRouter = Router({ mergeParams: true });

erpRouter.use(authJwt);
erpRouter.get('/', getErp);
