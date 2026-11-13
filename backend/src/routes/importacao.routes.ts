import { Router } from 'express';
import {
  deleteVinculo,
  getImportacoes,
  getPendencias,
  getSemCliente,
  postClientePelaNota,
  postImportacao,
  postLeitura,
  postVinculo,
} from '../controllers/importacao.controller';
import { authJwt } from '../middlewares/authJwt';
import { requireRole } from '../middlewares/requireRole';

/**
 * Importação de notas fiscais e vínculo com as visitas, montado em
 * `/erp`. Só o gestor importa e responde as pendências; o `requireRole` fica em
 * cada rota (e não em `router.use`) para não barrar `/erp/produtos`, que o
 * representante lê. `/importacoes/leitura` lê o PDF sem gravar (conferência antes
 * de importar). `/sem-cliente` lista os CNPJs das notas sem cliente e cria
 * o cliente pela nota fiscal.
 */
export const importacaoRouter = Router();

importacaoRouter.post('/importacoes', authJwt, requireRole('GESTOR'), postImportacao);
importacaoRouter.post('/importacoes/leitura', authJwt, requireRole('GESTOR'), postLeitura);
importacaoRouter.get('/importacoes', authJwt, requireRole('GESTOR'), getImportacoes);
importacaoRouter.get('/pendencias', authJwt, requireRole('GESTOR'), getPendencias);
importacaoRouter.post('/vendas/:id/vinculo', authJwt, requireRole('GESTOR'), postVinculo);
importacaoRouter.delete('/vendas/:id/vinculo', authJwt, requireRole('GESTOR'), deleteVinculo);
importacaoRouter.get('/sem-cliente', authJwt, requireRole('GESTOR'), getSemCliente);
importacaoRouter.post('/sem-cliente/:cnpj/cliente', authJwt, requireRole('GESTOR'), postClientePelaNota);
