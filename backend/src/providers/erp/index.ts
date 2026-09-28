import { env, type Env } from '../../config/env';
import type { ErpProvider } from './ErpProvider';
import { MockErpProvider } from './MockErpProvider';

/**
 * Seleciona o adapter de ERP a partir de `ERP_PROVIDER`, mesmo padrão de
 * `storage/index.ts`. Hoje só existe `'mock'`; um `'senior'` (integração
 * real) seria adicionado aqui, num novo `case`, sem alterar services nem
 * controllers — eles dependem apenas da interface `ErpProvider`.
 */
function criarErpProvider(env: Env): ErpProvider {
  switch (env.ERP_PROVIDER) {
    case 'mock':
      return new MockErpProvider({ falhar: env.ERP_MOCK_FALHAR });
  }
}

export const erpProvider: ErpProvider = criarErpProvider(env);
