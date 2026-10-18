import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { alterarSenhaSchema, redefinirSenhaSchema } from '../schemas/user.schema';
import { alterarSenha, login, obterUsuarioDaSessao, redefinirSenha } from '../services/auth.service';
import { usuarioAutenticado } from './usuarioAutenticado';

const loginSchema = z.object({
  email: z.string().trim().email('E-mail inválido.'),
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
 * Devolve o usuário autenticado lido do banco (nome, telefone e situação
 * atuais), a partir do id do token (`req.user`, populado por `authJwt`).
 * Serve para o frontend validar a sessão e atualizar os dados da conta.
 */
export async function getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const usuario = await obterUsuarioDaSessao(usuarioAutenticado(req).id);
    res.status(200).json(usuario);
  } catch (err) {
    next(err);
  }
}

/** Troca da própria senha (qualquer papel), conferindo a senha atual. */
export async function putPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { senhaAtual, novaSenha } = alterarSenhaSchema.parse(req.body);
    await alterarSenha(usuarioAutenticado(req).id, senhaAtual, novaSenha);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

/** Rota pública: quem recebeu o link por e-mail define a senha nova. */
export async function postRedefinirSenha(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { token, novaSenha } = redefinirSenhaSchema.parse(req.body);
    await redefinirSenha(token, novaSenha);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
