/**
 * Importado (só pelo efeito) como PRIMEIRO import de um arquivo de teste,
 * troca o provedor de ERP para `importado` antes de `config/env.ts` ser
 * carregado. `tests/setup-env.ts` fixa `ERP_PROVIDER=mock` para todos os
 * arquivos; como o Jest dá a cada arquivo de teste o próprio registro de
 * módulos, a troca vale só para o arquivo que importa este helper — mesmo
 * isolamento de `jest.isolateModules`, sem `require` dinâmico nem casts.
 */
process.env.ERP_PROVIDER = 'importado';
