/**
 * Estado de servidor da mensagem de consulta de estoque, como manda a
 * arquitetura do projeto: páginas e componentes não chamam a API diretamente
 * (ver docs/arquitetura.md).
 */
import { useQuery } from '@tanstack/react-query';
import { buscarProposta } from '../services/stockMessages';

/**
 * Proposta da mensagem (texto sugerido, contatos, evento vigente), buscada
 * só quando `habilitado`: o cabeçalho da ficha a usa para abrir o WhatsApp
 * já com a mensagem. Fica fresca por 5 minutos e não repete em caso de erro
 * (o link volta a levar só o número).
 */
export function usePropostaDeMensagem(clienteId: string | undefined, habilitado: boolean) {
  return useQuery({
    queryKey: ['client', clienteId, 'stock-message', 'proposta'],
    queryFn: () => buscarProposta(clienteId!),
    enabled: Boolean(clienteId) && habilitado,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}
