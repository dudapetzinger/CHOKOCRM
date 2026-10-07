/**
 * Estado de servidor dos insights sazonais do cliente (UC13) e dos alertas de
 * produção do gestor (UC15), Etapa 6B, como manda a arquitetura do projeto: as
 * páginas e os componentes não chamam a API diretamente (ver
 * docs/arquitetura.md). O horizonte faz parte da chave: cada horizonte tem seu
 * próprio cache. Sem retry, como `useDadosErp`: erro de rede/indisponibilidade
 * deve aparecer de imediato, não após tentativas silenciosas.
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { buscarAlertasDeProducao, buscarInsights } from '../services/insights';

/**
 * `placeholderData`: ao trocar de horizonte, o resultado do horizonte anterior
 * continua disponível (`isPlaceholderData`) até o novo chegar, em vez de o card
 * voltar a `isLoading` e sumir com o filtro. Só vale para o mesmo cliente: se a
 * ficha passar de um cliente a outro sem desmontar, os insights do cliente
 * anterior não podem aparecer na ficha do novo.
 */
export function useInsights(clienteId: string | undefined, horizonteDias: number) {
  return useQuery({
    queryKey: ['client', clienteId, 'insights', horizonteDias],
    queryFn: () => buscarInsights(clienteId!, horizonteDias),
    enabled: Boolean(clienteId),
    retry: false,
    placeholderData: (dadosAnteriores, consultaAnterior) =>
      consultaAnterior?.queryKey[1] === clienteId ? dadosAnteriores : undefined,
  });
}

/** `keepPreviousData` pelo mesmo motivo de `useInsights`: trocar o horizonte não esvazia o Painel. */
export function useAlertasDeProducao(horizonteDias: number) {
  return useQuery({
    queryKey: ['insights', 'manager-alerts', horizonteDias],
    queryFn: () => buscarAlertasDeProducao(horizonteDias),
    retry: false,
    placeholderData: keepPreviousData,
  });
}
