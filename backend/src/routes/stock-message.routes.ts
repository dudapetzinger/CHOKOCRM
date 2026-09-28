import { Router } from 'express';
import { getProposta, getStockMessages, postStockMessage } from '../controllers/stock-message.controller';
import { authJwt } from '../middlewares/authJwt';
import { requireRole } from '../middlewares/requireRole';

/**
 * Router aninhado sob `/clients/:id/stock-message` (montado com
 * `mergeParams` para enxergar o `:id` do cliente definido no prefixo do
 * app.ts). Propor e gerar a mensagem de estoque (UC12) é exclusivo do
 * representante — o gestor só consulta o histórico global abaixo.
 */
export const clientStockMessageRouter = Router({ mergeParams: true });

clientStockMessageRouter.use(authJwt);
clientStockMessageRouter.get('/proposta', requireRole('REPRESENTANTE'), getProposta);
clientStockMessageRouter.post('/', requireRole('REPRESENTANTE'), postStockMessage);

/** Router para o histórico global, montado em `/stock-messages`. Leitura liberada para qualquer papel. */
export const stockMessagesRouter = Router();

stockMessagesRouter.use(authJwt);
stockMessagesRouter.get('/', getStockMessages);
