import { Router } from 'express';
import { putRecurrence } from '../controllers/recurrence.controller';
import { authJwt } from '../middlewares/authJwt';
import { requireRole } from '../middlewares/requireRole';

/**
 * Router aninhado sob `/clients/:id/recurrence` (montado com `mergeParams`
 * para enxergar o `:id` do cliente definido no prefixo do app.ts). Alterar
 * a recorrência de visitas é exclusivo do representante (UC09).
 */
export const recurrenceRouter = Router({ mergeParams: true });

recurrenceRouter.use(authJwt);
recurrenceRouter.put('/', requireRole('REPRESENTANTE'), putRecurrence);
