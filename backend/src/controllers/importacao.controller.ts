import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { AppError } from '../errors/AppError';
import { ErrorCode } from '../errors/errorCodes';
import { cnpjDaNotaParamSchema, criarClientePelaNotaSchema } from '../schemas/cliente-pela-nota.schema';
import { nomeArquivoSchema, vincularNotaSchema } from '../schemas/importacao.schema';
import * as clientePelaNotaService from '../services/importacao-nf/cliente-pela-nota.service';
import * as importacaoService from '../services/importacao-nf/importacao.service';
import { usuarioAutenticado } from './usuarioAutenticado';

const idParamSchema = z.string().uuid('Identificador inválido.');

const MENSAGEM_TIPO_NAO_SUPORTADO = 'Envie o arquivo como application/pdf.';
const MENSAGEM_CORPO_VAZIO = 'O corpo da requisição deve conter os bytes do PDF.';

export async function postImportacao(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const usuario = usuarioAutenticado(req);

    const contentType = (req.headers['content-type'] ?? '').split(';')[0]?.trim() ?? '';
    if (contentType !== 'application/pdf') {
      throw new AppError(ErrorCode.UNSUPPORTED_MEDIA_TYPE, MENSAGEM_TIPO_NAO_SUPORTADO, 415);
    }
    // `express.raw` só popula `req.body` com Buffer quando o Content-Type casa com o filtro.
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, MENSAGEM_CORPO_VAZIO, 400);
    }

    const nome = nomeArquivoSchema.parse(typeof req.query.nome === 'string' ? req.query.nome : undefined);
    const importacao = await importacaoService.importarPdf(req.body, nome, usuario);
    res.status(201).json(importacao);
  } catch (err) {
    next(err);
  }
}

export async function getImportacoes(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json({ data: await importacaoService.listarImportacoes() });
  } catch (err) {
    next(err);
  }
}

export async function getPendencias(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json({ data: await importacaoService.listarPendencias() });
  } catch (err) {
    next(err);
  }
}

export async function postVinculo(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const saleId = idParamSchema.parse(req.params.id);
    const { visitId } = vincularNotaSchema.parse(req.body);
    res.status(200).json(await importacaoService.vincular(saleId, visitId));
  } catch (err) {
    next(err);
  }
}

export async function deleteVinculo(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const saleId = idParamSchema.parse(req.params.id);
    res.status(200).json(await importacaoService.desvincular(saleId));
  } catch (err) {
    next(err);
  }
}

/** CNPJs das notas sem cliente no CRM, agrupados (cliente pela nota). */
export async function getSemCliente(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(200).json({ data: await clientePelaNotaService.listarSemCliente() });
  } catch (err) {
    next(err);
  }
}

/** Cria o cliente do CNPJ com os dados da nota, na carteira escolhida pelo gestor. */
export async function postClientePelaNota(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const usuario = usuarioAutenticado(req);
    const cnpj = cnpjDaNotaParamSchema.parse(req.params.cnpj);
    const dados = criarClientePelaNotaSchema.parse(req.body);
    res.status(201).json(await clientePelaNotaService.criarClientePelaNota(cnpj, dados, usuario));
  } catch (err) {
    next(err);
  }
}
