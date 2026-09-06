import { Router } from 'express';
import { getMe, postLogin } from '../controllers/auth.controller';
import { authJwt } from '../middlewares/authJwt';

export const authRouter = Router();

authRouter.post('/login', postLogin);
authRouter.get('/me', authJwt, getMe);
