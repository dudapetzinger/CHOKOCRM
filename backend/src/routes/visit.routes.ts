import { Router } from 'express';
import {
  getVisitFoto,
  getVisitsByClient,
  patchVisit,
  postVisit,
  putVisitFoto,
} from '../controllers/visit.controller';
import { authJwt } from '../middlewares/authJwt';
import { requireRole } from '../middlewares/requireRole';

/**
 * Router aninhado sob `/clients/:id/visits` (montado com `mergeParams`
 * para enxergar o `:id` do cliente definido no prefixo do app.ts).
 * Registrar visita é exclusivo do representante (UC07).
 */
export const clientVisitsRouter = Router({ mergeParams: true });

clientVisitsRouter.use(authJwt);
clientVisitsRouter.post('/', requireRole('REPRESENTANTE'), postVisit);
/** Leitura liberada para o gestor também (UC08). */
clientVisitsRouter.get('/', getVisitsByClient);

/** Router para o recurso de visita isolado, montado em `/visits`. */
export const visitRouter = Router();

visitRouter.use(authJwt);
visitRouter.patch('/:id', requireRole('REPRESENTANTE'), patchVisit);
visitRouter.put('/:id/foto', requireRole('REPRESENTANTE'), putVisitFoto);
/** Leitura da foto liberada para o gestor também (UC08). */
visitRouter.get('/:id/foto', getVisitFoto);
