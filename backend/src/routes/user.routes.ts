import { Router } from 'express';
import { getUsers } from '../controllers/user.controller';
import { authJwt } from '../middlewares/authJwt';
import { requireRole } from '../middlewares/requireRole';

/**
 * Router montado em `/users`. Hoje só lista representantes (id e nome), para o
 * seletor de carteira do gestor; exclusivo do gestor.
 */
export const usersRouter = Router();

usersRouter.use(authJwt);
usersRouter.get('/', requireRole('GESTOR'), getUsers);
