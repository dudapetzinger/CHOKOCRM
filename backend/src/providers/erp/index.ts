import { env, type Env } from '../../config/env';
import type { ErpProvider } from './ErpProvider';
import { ImportadoErpProvider } from './ImportadoErpProvider';
import { MockErpProvider } from './MockErpProvider';

/**
 * Seleciona o adapter de ERP a partir de `ERP_PROVIDER`, mesmo padrão de
 * `storage/index.ts`: `'mock'` (simulado, desenvolvimento e testes) ou
 * `'importado'` (notas fiscais importadas, Etapa 12b — o de produção). Um
 * novo provedor seria outro `case`, sem alterar services nem controllers:
 * eles dependem apenas da interface `ErpProvider`, via `erp.service`.
 */
function criarErpProvider(env: Env): ErpProvider {
  switch (env.ERP_PROVIDER) {
    case 'mock':
      return new MockErpProvider({ falhar: env.ERP_MOCK_FALHAR });
    case 'importado':
      return new ImportadoErpProvider();
  }
}

export const erpProvider: ErpProvider = criarErpProvider(env);
