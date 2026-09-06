import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { createContactSchema, updateContactSchema } from '../schemas/contact.schema';
import * as contactService from '../services/contact.service';

const idParamSchema = z.string().min(1, 'Identificador é obrigatório.');

export async function postContact(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const clientId = idParamSchema.parse(req.params.id);
    const input = createContactSchema.parse(req.body);
    const contato = await contactService.createContact(clientId, input);
    res.status(201).json(contato);
  } catch (err) {
    next(err);
  }
}

export async function putContact(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = idParamSchema.parse(req.params.id);
    const input = updateContactSchema.parse(req.body);
    const contato = await contactService.updateContact(id, input);
    res.status(200).json(contato);
  } catch (err) {
    next(err);
  }
}

export async function deleteContact(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = idParamSchema.parse(req.params.id);
    await contactService.deleteContact(id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
