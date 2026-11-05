import { Router } from 'express';
import { getRelogio } from '../controllers/sistema.controller';
import { authJwt } from '../middlewares/authJwt';

/**
 * Informações do sistema abertas a qualquer usuário autenticado, montadas em
 * `/sistema`: o relógio (`GET /sistema/relogio`), com a data de demonstração
 * quando o relógio é simulado.
 */
export const sistemaRouter = Router();

sistemaRouter.use(authJwt);
sistemaRouter.get('/relogio', getRelogio);
