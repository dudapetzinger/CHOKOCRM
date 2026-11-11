/**
 * Importado (só pelo efeito) como PRIMEIRO import de um arquivo de teste,
 * troca o provedor de ERP para `hibrido` antes de `config/env.ts` ser
 * carregado: notas importadas para quem tem nota do CNPJ, ERP simulado (pelo
 * `erpId`) para os demais. `tests/setup-env.ts` fixa `ERP_PROVIDER=mock` para
 * todos os arquivos; como o Jest dá a cada arquivo de teste o próprio
 * registro de módulos, a troca vale só para o arquivo que importa este
 * helper — mesmo padrão de `provedor-importado.ts`.
 */
process.env.ERP_PROVIDER = 'hibrido';
