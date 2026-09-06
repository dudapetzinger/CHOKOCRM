import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { createClientSchema, listClientsQuerySchema, updateClientSchema } from '../schemas/client.schema';
import * as clientService from '../services/client.service';

const idParamSchema = z.string().min(1, 'Identificador do cliente é obrigatório.');

export async function getClients(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = listClientsQuerySchema.parse(req.query);
    const data = await clientService.listClients(query);
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function postClient(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = createClientSchema.parse(req.body);
    const cliente = await clientService.createClient(input);
    res.status(201).json(cliente);
  } catch (err) {
    next(err);
  }
}

export async function getClientById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = idParamSchema.parse(req.params.id);
    const cliente = await clientService.getClientById(id);
    res.status(200).json(cliente);
  } catch (err) {
    next(err);
  }
}

export async function putClient(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = idParamSchema.parse(req.params.id);
    const input = updateClientSchema.parse(req.body);
    const cliente = await clientService.updateClient(id, input);
    res.status(200).json(cliente);
  } catch (err) {
    next(err);
  }
}
