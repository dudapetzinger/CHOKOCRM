import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { login } from '../services/auth.service';

const loginSchema = z.object({
  email: z.string().email('E-mail inválido.'),
  senha: z.string().min(1, 'Senha é obrigatória.'),
});

export async function postLogin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, senha } = loginSchema.parse(req.body);
    const resultado = await login(email, senha);
    res.status(200).json(resultado);
  } catch (err) {
    next(err);
  }
}

/**
 * Devolve o usuário autenticado (`req.user`, populado pelo middleware
 * `authJwt`). Serve tanto para o frontend validar a sessão quanto como
 * rota protegida de referência para os testes de `authJwt`.
 */
export function getMe(req: Request, res: Response): void {
  res.status(200).json(req.user);
}
