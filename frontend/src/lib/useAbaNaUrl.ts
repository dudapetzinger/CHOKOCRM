/**
 * Aba guardada na URL (Etapa 9, spec das abas do Painel e da ficha do
 * cliente): lê `?<parametro>=` e devolve a aba e a função que a troca. Valor
 * ausente ou fora da lista vira o padrão. Trocar usa `replace` (as abas não
 * enchem o histórico), preserva os outros parâmetros (a Agenda usa
 * `?visao=`, Clientes usa a busca) e omite o parâmetro quando a aba é a
 * padrão, para a URL "limpa" continuar sendo a da primeira aba.
 */
import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

export function useAbaNaUrl<V extends string>(
  parametro: string,
  abas: readonly V[],
  padrao: V,
): [V, (valor: V) => void] {
  const [busca, setBusca] = useSearchParams();

  const lido = busca.get(parametro);
  const aba = abas.find((valor) => valor === lido) ?? padrao;

  const trocar = useCallback(
    (valor: V) => {
      setBusca(
        (anterior) => {
          const proxima = new URLSearchParams(anterior);
          if (valor === padrao) proxima.delete(parametro);
          else proxima.set(parametro, valor);
          return proxima;
        },
        { replace: true },
      );
    },
    [parametro, padrao, setBusca],
  );

  return [aba, trocar];
}
