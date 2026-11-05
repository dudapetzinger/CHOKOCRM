/**
 * Importação de notas fiscais (DANFE em PDF) do gestor (Etapa 12b). Espelha
 * os DTOs de `/erp/importacoes`, `/erp/pendencias` e `/erp/vendas/:id/vinculo`
 * do backend. Um PDF por requisição: a página manda os arquivos um a um.
 */
import { api } from './api';
import type { ResultadoVisita } from './visits';

export type VinculoNota = 'AUTOMATICO' | 'PENDENTE' | 'VINCULADA' | 'RECUSADA' | 'SEM_VISITA' | 'SEM_CLIENTE';

export type VisitaSugerida = {
  id: string;
  /** ISO. */
  dataHora: string;
  resultado: ResultadoVisita | null;
  totalPedido: number | null;
};

export type ItemDaNota = {
  codigo: string;
  descricao: string;
  quantidade: number;
  precoUnitario: number;
  valorTotal: number;
};

export type Nota = {
  id: string;
  chaveAcesso: string;
  numero: string;
  serie: string;
  /** ISO. */
  dataEmissao: string;
  destinatarioNome: string;
  destinatarioCnpj: string;
  cliente: { id: string; nomeFantasia: string } | null;
  valorProdutos: number;
  desconto: number;
  valorTotal: number;
  itens: ItemDaNota[];
  vinculo: VinculoNota;
  visitaSugerida: VisitaSugerida | null;
  visitaVinculadaId: string | null;
};

export type Importacao = {
  id: string;
  nomeArquivo: string;
  criadoEm: string;
  autor: { id: string; nome: string };
  notas: Nota[];
  ignoradas: { numero: string | null; motivo: string }[];
  cnpjsSemCliente: { cnpj: string; razaoSocial: string }[];
};

export function importarPdf(arquivo: File): Promise<Importacao> {
  return api.postBinario<Importacao>(
    `/erp/importacoes?nome=${encodeURIComponent(arquivo.name)}`,
    arquivo,
    'application/pdf',
  );
}

export async function listarImportacoes(): Promise<Importacao[]> {
  const resposta = await api.get<{ data: Importacao[] }>('/erp/importacoes');
  return resposta.data;
}

export async function listarPendencias(): Promise<Nota[]> {
  const resposta = await api.get<{ data: Nota[] }>('/erp/pendencias');
  return resposta.data;
}

export function vincularNota(id: string, visitId: string): Promise<Nota> {
  return api.post<Nota>(`/erp/vendas/${id}/vinculo`, { visitId });
}

export function desvincularNota(id: string): Promise<Nota> {
  return api.del<Nota>(`/erp/vendas/${id}/vinculo`);
}
