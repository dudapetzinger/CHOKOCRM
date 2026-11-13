/**
 * Acesso tipado aos dados de venda/estoque do cliente no ERP.
 * Espelha o shape de `DadosErpDTO` de `backend/src/services/erp.service.ts`,
 * com as últimas notas importadas, a marca de estoque indisponível e a
 * origem de cada venda (nota ou pedido do check-in).
 */
import { api } from './api';

export type NivelEstoque = 'BAIXO' | 'NORMAL' | 'ALTO';

/** De onde veio a venda: nota importada (número da NF) ou pedido do check-in; ausente no mock. */
export type OrigemVendaErp = { tipo: 'nota'; numero: string } | { tipo: 'pedido'; visitaId: string };

/** Venda do ERP na ficha: data de calendário 'AAAA-MM-DD' (nunca vira `Date`), valor, itens e origem. */
export type VendaErp = {
  data: string;
  valor: number;
  origem?: OrigemVendaErp;
  produtos: { sku: string; nome: string; quantidade: number }[];
};

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
      /** O provedor não informa estoque (notas importadas): `estoque` vem `null`. */
      estoqueIndisponivel: boolean;
      /** As 5 vendas mais recentes, da mais nova para a mais antiga; vazio nos dados simulados. */
      ultimasVendas: VendaErp[];
    }
  | { status: 'SEM_ERP_ID' }
  | { status: 'NAO_ENCONTRADO' }
  | { status: 'INDISPONIVEL' };

export function buscarDadosErp(clienteId: string): Promise<DadosErp> {
  return api.get<DadosErp>(`/clients/${clienteId}/erp`);
}

/** Produto do catálogo do ERP, com o preço do dia (`ProdutoDTO` do backend). */
export type Produto = { sku: string; nome: string; precoUnitario: number };

/** Catálogo de produtos das campanhas, na ordem do ERP. */
export async function listarProdutos(): Promise<Produto[]> {
  const resposta = await api.get<{ data: Produto[] }>('/erp/produtos');
  return resposta.data;
}
