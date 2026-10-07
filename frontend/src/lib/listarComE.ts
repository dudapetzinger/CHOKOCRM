/** Junta itens em português: 'a', 'a e b', 'a, b e c'. Lista vazia vira texto vazio. */
export function listarComE(itens: string[]): string {
  if (itens.length <= 1) return itens.join('');
  return `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`;
}
