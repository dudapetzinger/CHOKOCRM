import { env, type Env } from '../../config/env';
import type { ErpProvider } from './ErpProvider';
import { HibridoErpProvider } from './HibridoErpProvider';
import { ImportadoErpProvider } from './ImportadoErpProvider';
import { MockErpProvider } from './MockErpProvider';

/**
 * Seleciona o adapter de ERP a partir de `ERP_PROVIDER`, mesmo padrão de
 * `storage/index.ts`: `'mock'` (simulado, desenvolvimento e testes),
 * `'importado'` (só as notas fiscais importadas) ou `'hibrido'`
 * (o padrão e o de produção: as notas para o cliente que tem nota do CNPJ e
 * o simulado pelo `erpId` para os demais; compõe os outros dois). Um novo
 * provedor seria outro `case`, sem alterar services nem controllers: eles
 * dependem apenas da interface `ErpProvider`, via `erp.service`.
 */
function criarErpProvider(env: Env): ErpProvider {
  switch (env.ERP_PROVIDER) {
    case 'mock':
      return new MockErpProvider({ falhar: env.ERP_MOCK_FALHAR });
    case 'importado':
      return new ImportadoErpProvider();
    case 'hibrido':
      return new HibridoErpProvider(new ImportadoErpProvider(), new MockErpProvider({ falhar: env.ERP_MOCK_FALHAR }));
  }
}

export const erpProvider: ErpProvider = criarErpProvider(env);
