/**
 * Importação de notas fiscais (DANFE em PDF) do gestor (Etapa 12b). Espelha
 * os DTOs de `/erp/importacoes`, `/erp/pendencias`, `/erp/vendas/:id/vinculo`
 * e `/erp/sem-cliente` do backend. Um PDF por requisição: a página manda os
 * arquivos um a um. "Cliente pela nota": o gestor cria o cliente de um CNPJ
 * sem cadastro com os dados da DANFE, escolhendo o representante.
 * Conferência: `lerPdf` lê o PDF sem gravar (`/erp/importacoes/leitura`)
 * para o gestor conferir; confirmado, o mesmo arquivo vai a `importarPdf`.
 */
import { api } from './api';
import type { ClienteCompleto } from './clients';
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
  /** Data de calendário 'AAAA-MM-DD' (nunca virar `Date`: o dia voltaria um no fuso -03:00). */
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

/** Nota como a leitura sem gravar a devolve (`NotaLidaDTO` do backend). */
export type NotaLida = {
  chaveAcesso: string;
  numero: string;
  serie: string;
  /** Data de calendário 'AAAA-MM-DD'. */
  dataEmissao: string;
  destinatarioNome: string;
  /** Só dígitos. */
  destinatarioCnpj: string;
  cliente: { id: string; nomeFantasia: string } | null;
  valorTotal: number;
  itens: ItemDaNota[];
  /** A chave de acesso já existe no CRM: confirmar atualiza a nota. */
  jaImportada: boolean;
};

export type Leitura = {
  notas: NotaLida[];
  ignoradas: { numero: string | null; motivo: string }[];
};

/** Lê as notas de um PDF sem gravar nada (conferência antes de importar). */
export function lerPdf(arquivo: File): Promise<Leitura> {
  return api.postBinario<Leitura>(
    `/erp/importacoes/leitura?nome=${encodeURIComponent(arquivo.name)}`,
    arquivo,
    'application/pdf',
  );
}

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

/** Um CNPJ com notas `SEM_CLIENTE`, com os dados do destinatário da nota mais recente. */
export type CnpjSemCliente = {
  /** 14 dígitos. */
  cnpj: string;
  razaoSocial: string;
  endereco: string | null;
  bairro: string | null;
  cep: string | null;
  municipio: string | null;
  uf: string | null;
  telefone: string | null;
  /** Quantas notas sem cliente esse CNPJ tem. */
  notas: number;
  /** Data de calendário 'AAAA-MM-DD' da nota mais recente. */
  ultimaEmissao: string;
};

/** Sem nome fantasia, vale a razão social; sem recorrência, 15 dias (regras do backend). */
export type DadosClientePelaNota = {
  representanteId: string;
  nomeFantasia?: string;
  recorrenciaDias?: number;
};

export async function listarSemCliente(): Promise<CnpjSemCliente[]> {
  const resposta = await api.get<{ data: CnpjSemCliente[] }>('/erp/sem-cliente');
  return resposta.data;
}

/** Cria o cliente com os dados da nota; as notas desse CNPJ passam a ser dele. */
export function criarClientePelaNota(cnpj: string, dados: DadosClientePelaNota): Promise<ClienteCompleto> {
  return api.post<ClienteCompleto>(`/erp/sem-cliente/${encodeURIComponent(cnpj)}/cliente`, dados);
}
