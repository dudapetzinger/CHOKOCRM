import { Router } from 'express';
import { deleteCampaign, getCampaigns, postCampaign, putCampaign } from '../controllers/campaign.controller';
import { authJwt } from '../middlewares/authJwt';
import { requireRole } from '../middlewares/requireRole';

/**
 * Campanhas, promoções e eventos, montado em `/campaigns` (spec 7.7).
 * Qualquer usuário autenticado lê (a lista tem as vendas vinculadas no
 * escopo dele); criar, alterar e excluir é só do gestor (403 para o
 * representante).
 */
export const campaignsRouter = Router();

campaignsRouter.use(authJwt);
campaignsRouter.get('/', getCampaigns);
campaignsRouter.post('/', requireRole('GESTOR'), postCampaign);
campaignsRouter.put('/:id', requireRole('GESTOR'), putCampaign);
campaignsRouter.delete('/:id', requireRole('GESTOR'), deleteCampaign);
