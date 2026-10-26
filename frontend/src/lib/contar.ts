/**
 * Quantidade com a palavra no número certo: `contar(1, 'cliente')` é
 * "1 cliente", `contar(3, 'cliente')` é "3 clientes" e `contar(0, 'visita')`,
 * "0 visitas". O plural padrão é o singular com "s"; para outro, passe o
 * terceiro argumento (`contar(2, 'cliente ativo', 'clientes ativos')`).
 */
export function contar(quantidade: number, singular: string, plural = `${singular}s`): string {
  return `${quantidade} ${quantidade === 1 ? singular : plural}`;
}
