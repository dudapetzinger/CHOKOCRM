import type { NextFunction, Request, Response } from 'express';
import { alterarSenhaSchema, credenciaisSchema } from '../schemas/user.schema';
import { alterarSenha, login, obterUsuarioDaSessao } from '../services/auth.service';
import { usuarioAutenticado } from './usuarioAutenticado';

export async function postLogin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { usuario, senha } = credenciaisSchema.parse(req.body);
    const resultado = await login(usuario, senha);
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
