import { Router } from 'express';
import {
  deleteVinculo,
  getImportacoes,
  getPendencias,
  postImportacao,
  postVinculo,
} from '../controllers/importacao.controller';
import { authJwt } from '../middlewares/authJwt';
import { requireRole } from '../middlewares/requireRole';

/**
 * Importação de notas fiscais e vínculo com as visitas (Etapa 12b), montado em
 * `/erp`. Só o gestor importa e responde as pendências; o `requireRole` fica em
 * cada rota (e não em `router.use`) para não barrar `/erp/produtos`, que o
 * representante lê.
 */
export const importacaoRouter = Router();

importacaoRouter.post('/importacoes', authJwt, requireRole('GESTOR'), postImportacao);
importacaoRouter.get('/importacoes', authJwt, requireRole('GESTOR'), getImportacoes);
importacaoRouter.get('/pendencias', authJwt, requireRole('GESTOR'), getPendencias);
importacaoRouter.post('/vendas/:id/vinculo', authJwt, requireRole('GESTOR'), postVinculo);
importacaoRouter.delete('/vendas/:id/vinculo', authJwt, requireRole('GESTOR'), deleteVinculo);
