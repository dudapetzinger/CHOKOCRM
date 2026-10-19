import { Router } from 'express';
import { deleteGoal, getGoals, postGoal, putGoal } from '../controllers/goal.controller';
import { authJwt } from '../middlewares/authJwt';
import { requireRole } from '../middlewares/requireRole';

/**
 * Metas de visitas e vendas, montado em `/goals` (spec 7.8). Qualquer
 * usuário autenticado lê (o representante, só as próprias); criar, alterar
 * e excluir é só do gestor (403 para o representante).
 */
export const goalsRouter = Router();

goalsRouter.use(authJwt);
goalsRouter.get('/', getGoals);
goalsRouter.post('/', requireRole('GESTOR'), postGoal);
goalsRouter.put('/:id', requireRole('GESTOR'), putGoal);
goalsRouter.delete('/:id', requireRole('GESTOR'), deleteGoal);
