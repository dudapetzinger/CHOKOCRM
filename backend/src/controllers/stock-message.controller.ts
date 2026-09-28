import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { gerarMensagemSchema, listarQuerySchema } from '../schemas/stock-message.schema';
import * as stockMessageService from '../services/stock-message.service';
import { usuarioAutenticado } from './usuarioAutenticado';

const idParamSchema = z.string().uuid('Identificador inválido.');

/** `GET /clients/:id/stock-message/proposta` — não grava nada (UC12). */
export async function getProposta(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const clientId = idParamSchema.parse(req.params.id);
    const usuario = usuarioAutenticado(req);

    const proposta = await stockMessageService.propor(clientId, usuario);
    res.status(200).json(proposta);
  } catch (err) {
    next(err);
  }
}

/** `POST /clients/:id/stock-message` — grava a mensagem e devolve o link do WhatsApp (UC12). */
export async function postStockMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const clientId = idParamSchema.parse(req.params.id);
    const input = gerarMensagemSchema.parse(req.body);
    const usuario = usuarioAutenticado(req);

    const geracao = await stockMessageService.gerar(clientId, usuario, input);
    res.status(201).json(geracao);
  } catch (err) {
    next(err);
  }
}

/** `GET /stock-messages?clientId=` — histórico global, sem filtro de carteira. */
export async function getStockMessages(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = listarQuerySchema.parse(req.query);
    const data = await stockMessageService.listar(query);
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}
