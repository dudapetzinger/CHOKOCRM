import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { listClientsQuerySchema, updateClientSchema } from '../schemas/client.schema';
import * as clientService from '../services/client.service';
import { usuarioAutenticado } from './usuarioAutenticado';

const idParamSchema = z.string().min(1, 'Identificador do cliente é obrigatório.');

export async function getClients(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = listClientsQuerySchema.parse(req.query);
    const data = await clientService.listClients(query, usuarioAutenticado(req));
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function getClientById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = idParamSchema.parse(req.params.id);
    const cliente = await clientService.getClientById(id, usuarioAutenticado(req));
    res.status(200).json(cliente);
  } catch (err) {
    next(err);
  }
}

export async function putClient(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = idParamSchema.parse(req.params.id);
    const input = updateClientSchema.parse(req.body);
    const cliente = await clientService.updateClient(id, input, usuarioAutenticado(req));
    res.status(200).json(cliente);
  } catch (err) {
    next(err);
  }
}
