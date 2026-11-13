import { Router } from 'express';
import { getProposta } from '../controllers/stock-message.controller';
import { authJwt } from '../middlewares/authJwt';
import { requireRole } from '../middlewares/requireRole';

/**
 * Router aninhado sob `/clients/:id/stock-message` (montado com
 * `mergeParams` para enxergar o `:id` do cliente definido no prefixo do
 * app.ts). A proposta de mensagem de estoque é exclusiva do representante.
 */
export const clientStockMessageRouter = Router({ mergeParams: true });

clientStockMessageRouter.use(authJwt);
clientStockMessageRouter.get('/proposta', requireRole('REPRESENTANTE'), getProposta);
