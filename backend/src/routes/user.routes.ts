import { Router } from 'express';
import {
  getUsers,
  patchUser,
  postRedefinicaoDeSenha,
  postTransferirCarteira,
  postUser,
} from '../controllers/user.controller';
import { authJwt } from '../middlewares/authJwt';
import { requireRole } from '../middlewares/requireRole';
import { requireRoleAtual } from '../middlewares/requireRoleAtual';

/**
 * Router montado em `/users`: gestão de usuários (spec da Etapa 8, 7.13),
 * exclusiva do gestor em todas as rotas. Também serve o seletor de
 * representante (`GET /users?role=REPRESENTANTE`). Além do papel do token,
 * confere no banco que o gestor continua ativo e gestor (`requireRoleAtual`).
 */
export const usersRouter = Router();

usersRouter.use(authJwt, requireRole('GESTOR'), requireRoleAtual('GESTOR'));
usersRouter.get('/', getUsers);
usersRouter.post('/', postUser);
usersRouter.patch('/:id', patchUser);
usersRouter.post('/:id/transferir-carteira', postTransferirCarteira);
usersRouter.post('/:id/redefinicao-de-senha', postRedefinicaoDeSenha);
