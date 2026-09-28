/** Iniciais exibidas no avatar de listas de clientes (1 ou 2 letras). */
export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0]!.slice(0, 2).toUpperCase();
  return (partes[0]![0] + partes[1]![0]).toUpperCase();
}
