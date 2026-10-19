import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { listarMetasQuerySchema, metaSchema } from '../schemas/goal.schema';
import * as goalService from '../services/goal.service';
import { usuarioAutenticado } from './usuarioAutenticado';

const idParamSchema = z.string().min(1, 'Identificador é obrigatório.');

export async function getGoals(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const filtro = listarMetasQuerySchema.parse(req.query);
    const data = await goalService.listarMetas(usuarioAutenticado(req), filtro);
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function postGoal(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = metaSchema.parse(req.body);
    const meta = await goalService.criarMeta(input);
    res.status(201).json(meta);
  } catch (err) {
    next(err);
  }
}

export async function putGoal(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = idParamSchema.parse(req.params.id);
    const input = metaSchema.parse(req.body);
    const meta = await goalService.atualizarMeta(id, input);
    res.status(200).json(meta);
  } catch (err) {
    next(err);
  }
}

export async function deleteGoal(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = idParamSchema.parse(req.params.id);
    await goalService.excluirMeta(id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
