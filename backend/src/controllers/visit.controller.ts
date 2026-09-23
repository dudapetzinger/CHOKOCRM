import type { Role } from '@prisma/client';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { AppError } from '../errors/AppError';
import { ErrorCode } from '../errors/errorCodes';
import { createVisitSchema, updateVisitSchema } from '../schemas/visit.schema';
import * as visitService from '../services/visit.service';

const idParamSchema = z.string().uuid('Identificador inválido.');

const MENSAGEM_SEM_USUARIO = 'Token de autenticação ausente ou inválido.';
const MENSAGEM_TIPO_NAO_SUPORTADO = 'Envie a foto como image/jpeg, image/png ou image/webp.';
const MENSAGEM_CORPO_VAZIO = 'O corpo da requisição deve conter os bytes da foto.';

const TIPOS_DE_IMAGEM_ACEITOS = ['image/jpeg', 'image/png', 'image/webp'];

/** `authJwt` popula `req.user`; esta guarda estreita o tipo sem asserção. */
function usuarioAutenticado(req: Request): { id: string; role: Role } {
  if (!req.user) {
    throw new AppError(ErrorCode.UNAUTHORIZED, MENSAGEM_SEM_USUARIO, 401);
  }

  return req.user;
}

export async function getVisitsByClient(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const clientId = idParamSchema.parse(req.params.id);
    const data = await visitService.listVisitsByClient(clientId);
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function postVisit(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const clientId = idParamSchema.parse(req.params.id);
    const input = createVisitSchema.parse(req.body);
    const usuario = usuarioAutenticado(req);

    const visita = await visitService.createVisit(clientId, usuario.id, input);
    res.status(201).json(visita);
  } catch (err) {
    next(err);
  }
}

export async function patchVisit(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const visitId = idParamSchema.parse(req.params.id);
    const input = updateVisitSchema.parse(req.body);
    const usuario = usuarioAutenticado(req);

    const visita = await visitService.updateDescricao(visitId, usuario.id, input);
    res.status(200).json(visita);
  } catch (err) {
    next(err);
  }
}

export async function putVisitFoto(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const visitId = idParamSchema.parse(req.params.id);
    const usuario = usuarioAutenticado(req);

    const contentType = (req.headers['content-type'] ?? '').split(';')[0]?.trim() ?? '';
    if (!TIPOS_DE_IMAGEM_ACEITOS.includes(contentType)) {
      throw new AppError(ErrorCode.UNSUPPORTED_MEDIA_TYPE, MENSAGEM_TIPO_NAO_SUPORTADO, 415);
    }

    // `express.raw` só popula `req.body` com Buffer quando o Content-Type
    // casa com o filtro; qualquer outra coisa chega aqui como objeto vazio.
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, MENSAGEM_CORPO_VAZIO, 400);
    }

    const visita = await visitService.anexarFoto(visitId, usuario.id, req.body);
    res.status(200).json(visita);
  } catch (err) {
    next(err);
  }
}

export async function getVisitFoto(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const visitId = idParamSchema.parse(req.params.id);
    const { conteudo, contentType } = await visitService.lerFoto(visitId);

    res.status(200).type(contentType).set('Cache-Control', 'private, max-age=3600').send(conteudo);
  } catch (err) {
    next(err);
  }
}
