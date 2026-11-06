/**
 * Acesso tipado aos dados de venda/estoque do cliente no ERP (UC11, Etapa 5).
 * Espelha o shape de `DadosErpDTO` de `backend/src/services/erp.service.ts`,
 * com as últimas notas importadas e a marca de estoque indisponível (Etapa 12b)
 * e a origem de cada venda (nota ou pedido do check-in).
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

/** Catálogo para o pedido do check-in (spec 7.5), na ordem do ERP. */
export async function listarProdutos(): Promise<Produto[]> {
  const resposta = await api.get<{ data: Produto[] }>('/erp/produtos');
  return resposta.data;
}

/** Situação da fonte de vendas do ERP (`GET /erp/situacao`, qualquer papel). */
export type SituacaoErp = {
  provedor: 'mock' | 'importado';
  simulado: boolean;
  estoqueDisponivel: boolean;
  /** 'AAAA-MM-DD' da venda mais recente; `null` sem notas. */
  ultimaVendaEm: string | null;
  /** ISO da última importação; `null` se nunca houve. */
  ultimaImportacaoEm: string | null;
};

export function buscarSituacaoErp(): Promise<SituacaoErp> {
  return api.get<SituacaoErp>('/erp/situacao');
}
