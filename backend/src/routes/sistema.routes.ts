import { Router } from 'express';
import { getRelogio, postDemonstracao } from '../controllers/sistema.controller';

/**
 * Rotas de sistema montadas em `/sistema`, PÚBLICAS (sem `authJwt`): a tela
 * de login lê o relógio (`GET /sistema/relogio`) e liga o modo demonstração
 * (`POST /sistema/demonstracao`, que confere a senha da conta Gestão no
 * corpo). Ver `controllers/sistema.controller.ts`.
 */
export const sistemaRouter = Router();

sistemaRouter.get('/relogio', getRelogio);
sistemaRouter.post('/demonstracao', postDemonstracao);
