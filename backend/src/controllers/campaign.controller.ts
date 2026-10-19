import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { campanhaSchema } from '../schemas/campaign.schema';
import * as campaignService from '../services/campaign.service';
import { usuarioAutenticado } from './usuarioAutenticado';

const idParamSchema = z.string().min(1, 'Identificador é obrigatório.');

export async function getCampaigns(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await campaignService.listarCampanhas(usuarioAutenticado(req));
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

export async function postCampaign(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = campanhaSchema.parse(req.body);
    const campanha = await campaignService.criarCampanha(input, usuarioAutenticado(req));
    res.status(201).json(campanha);
  } catch (err) {
    next(err);
  }
}

export async function putCampaign(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = idParamSchema.parse(req.params.id);
    const input = campanhaSchema.parse(req.body);
    const campanha = await campaignService.atualizarCampanha(id, input, usuarioAutenticado(req));
    res.status(200).json(campanha);
  } catch (err) {
    next(err);
  }
}

export async function deleteCampaign(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = idParamSchema.parse(req.params.id);
    await campaignService.excluirCampanha(id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
