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

/** Produto do catálogo do ERP, com o preço do dia (`ProdutoDTO` do backend). */
export type Produto = { sku: string; nome: string; precoUnitario: number };

/** Catálogo para o pedido do check-in (spec 7.5), na ordem do ERP. */
export async function listarProdutos(): Promise<Produto[]> {
  const resposta = await api.get<{ data: Produto[] }>('/erp/produtos');
  return resposta.data;
}
