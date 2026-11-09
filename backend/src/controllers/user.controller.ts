import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import {
  createUserSchema,
  definirSenhaSchema,
  listUsersQuerySchema,
  transferirCarteiraSchema,
  updateUserSchema,
} from '../schemas/user.schema';
import * as userService from '../services/user.service';
import { usuarioAutenticado } from './usuarioAutenticado';

const idParamSchema = z.string().min(1, 'Identificador é obrigatório.');

/**
 * Sem `role`, todos os usuários (tela de Usuários); com
 * `?role=REPRESENTANTE`, o contrato do seletor do gestor (só ativos, id e nome).
 */
export async function getUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { role } = listUsersQuerySchema.parse(req.query);

    const data = role ? await userService.listarRepresentantesAtivos() : await userService.listarUsuarios();
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function postUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = createUserSchema.parse(req.body);
    const usuario = await userService.criarUsuario(input);
    res.status(201).json(usuario);
  } catch (err) {
    next(err);
  }
}

export async function patchUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = idParamSchema.parse(req.params.id);
    const input = updateUserSchema.parse(req.body);
    const usuario = await userService.atualizarUsuario(id, input, usuarioAutenticado(req));
    res.status(200).json(usuario);
  } catch (err) {
    next(err);
  }
}

export async function postTransferirCarteira(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const origemId = idParamSchema.parse(req.params.id);
    const { destinoId } = transferirCarteiraSchema.parse(req.body);
    const resultado = await userService.transferirCarteira(origemId, destinoId);
    res.status(200).json(resultado);
  } catch (err) {
    next(err);
  }
}

/** Senha provisória definida pelo gestor: 204, sem corpo. */
export async function putSenha(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = idParamSchema.parse(req.params.id);
    const { senha } = definirSenhaSchema.parse(req.body);
    await userService.definirSenhaProvisoria(id, senha);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
