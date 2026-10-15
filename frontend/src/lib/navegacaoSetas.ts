/**
 * Navegação por setas num grupo de opções (`role="radiogroup"`): a partir
 * da tecla e do índice atual, devolve o índice da próxima opção (com volta
 * ao início/fim) ou `null` quando a tecla não é de navegação.
 */
export function proximoIndicePorSeta(tecla: string, atual: number, total: number): number | null {
  if (tecla === 'ArrowRight' || tecla === 'ArrowDown') return (atual + 1) % total;
  if (tecla === 'ArrowLeft' || tecla === 'ArrowUp') return (atual - 1 + total) % total;
  if (tecla === 'Home') return 0;
  if (tecla === 'End') return total - 1;
  return null;
}
