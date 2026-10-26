import { Router } from 'express';
import { getLembretesDoCliente, patchConcluirLembrete } from '../controllers/reminder.controller';
import { authJwt } from '../middlewares/authJwt';

/**
 * Router aninhado sob `/clients/:id/lembretes` (montado com `mergeParams`
 * para enxergar o `:id` do cliente definido no prefixo do app.ts): os
 * lembretes abertos do cliente, para o representante da carteira e o gestor.
 */
export const clientLembretesRouter = Router({ mergeParams: true });

clientLembretesRouter.use(authJwt);
clientLembretesRouter.get('/', getLembretesDoCliente);

/**
 * Router montado em `/lembretes`. Concluir vale para o dono da carteira e
 * para o gestor (a regra de carteira fica no serviço), sem `requireRole`.
 */
export const lembretesRouter = Router();

lembretesRouter.use(authJwt);
lembretesRouter.patch('/:id/concluir', patchConcluirLembrete);
