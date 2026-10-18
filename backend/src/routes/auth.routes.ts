import { Router } from 'express';
import { getMe, postLogin, postRedefinirSenha, putPassword } from '../controllers/auth.controller';
import { authJwt } from '../middlewares/authJwt';

export const authRouter = Router();

authRouter.post('/login', postLogin);
// Pública: o link do e-mail é a credencial (ver auth.service#redefinirSenha).
authRouter.post('/redefinir-senha', postRedefinirSenha);
authRouter.get('/me', authJwt, getMe);
authRouter.put('/password', authJwt, putPassword);
