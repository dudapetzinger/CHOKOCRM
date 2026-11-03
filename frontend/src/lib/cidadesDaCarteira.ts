/**
 * Cidades da carteira para o select da aba Clientes (Etapa 11). Grafias
 * diferentes da mesma cidade ("Blumenau", "blumenau ", "BLUMENAU") viram uma
 * só opção, agrupadas por `normalizarCidade` (a mesma chave do roteiro).
 */
import { normalizarCidade } from './roteiro';

export type CidadeDaCarteira = { chave: string; nome: string };

/** Uma opção por cidade; o nome é a primeira grafia vista, em ordem alfabética (pt-BR). */
export function cidadesDaCarteira(clientes: readonly { cidade: string }[]): CidadeDaCarteira[] {
  const porChave = new Map<string, string>();
  for (const { cidade } of clientes) {
    const chave = normalizarCidade(cidade);
    if (chave !== '' && !porChave.has(chave)) {
      porChave.set(chave, cidade.trim());
    }
  }
  return [...porChave].map(([chave, nome]) => ({ chave, nome })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

/** `chave` vazia = todas as cidades. */
export function filtrarPorCidade<T extends { cidade: string }>(clientes: readonly T[], chave: string): T[] {
  return chave === '' ? [...clientes] : clientes.filter((cliente) => normalizarCidade(cliente.cidade) === chave);
}
