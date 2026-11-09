import { Router } from 'express';
import { getMe, postLogin, putPassword } from '../controllers/auth.controller';
import { authJwt } from '../middlewares/authJwt';

export const authRouter = Router();

authRouter.post('/login', postLogin);
authRouter.get('/me', authJwt, getMe);
authRouter.put('/password', authJwt, putPassword);
