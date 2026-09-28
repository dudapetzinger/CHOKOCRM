/**
 * Acesso tipado aos dados de venda/estoque do cliente no ERP (UC11, Etapa 5).
 * Espelha o shape de `DadosErpDTO` de `backend/src/services/erp.service.ts`.
 */
import { api } from './api';

export type NivelEstoque = 'BAIXO' | 'NORMAL' | 'ALTO';

export type DadosErp =
  | {
      status: 'OK';
      simulado: boolean;
      ultimaVenda: { data: string; valor: number } | null;
      volume90Dias: { total: number; quantidadeVendas: number };
      estoque: {
        nivel: NivelEstoque;
        atualizadoEm: string;
        itensBaixos: { sku: string; nome: string; quantidade: number }[];
      } | null;
    }
  | { status: 'SEM_ERP_ID' }
  | { status: 'NAO_ENCONTRADO' }
  | { status: 'INDISPONIVEL' };

export function buscarDadosErp(clienteId: string): Promise<DadosErp> {
  return api.get<DadosErp>(`/clients/${clienteId}/erp`);
}
