/**
 * Acesso tipado às campanhas, promoções e eventos (spec 7.7). Espelha o
 * `CampanhaDTO` de `backend/src/services/campaign.service.ts`: o status e as
 * vendas vinculadas vêm calculados do backend (o front não recalcula regra).
 * Todos leem; criar, alterar e excluir é só do gestor no backend.
 */
import { api } from './api';

export type TipoCampanha = 'CAMPANHA' | 'PROMOCAO' | 'EVENTO';

/** Pelo dia de hoje em São Paulo, início e fim inclusivos. */
export type StatusCampanha = 'PROGRAMADA' | 'EM_ANDAMENTO' | 'ENCERRADA';

export const ROTULO_TIPO: Record<TipoCampanha, string> = {
  CAMPANHA: 'Campanha',
  PROMOCAO: 'Promoção',
  EVENTO: 'Evento',
};

export const ROTULO_STATUS: Record<StatusCampanha, string> = {
  PROGRAMADA: 'Programada',
  EM_ANDAMENTO: 'Em andamento',
  ENCERRADA: 'Encerrada',
};

/** Vendas (R$) e visitas vinculadas à campanha de um representante. */
export type ResultadoDaCampanha = {
  representante: { id: string; nome: string };
  vendas: number;
  visitas: number;
};

export type Campanha = {
  id: string;
  nome: string;
  tipo: TipoCampanha;
  /** `AAAA-MM-DD`, inclusivo. */
  inicio: string;
  /** `AAAA-MM-DD`, inclusivo. */
  fim: string;
  descricao: string;
  /** Em %; `null` sem desconto. */
  desconto: number | null;
  produtos: { sku: string; nome: string }[];
  status: StatusCampanha;
  /** O representante recebe só a própria linha; o gestor, uma por representante. */
  resultados: ResultadoDaCampanha[];
};

/** Corpo de criar e de alterar (o `PUT` troca a campanha inteira). */
export type CampanhaInput = {
  nome: string;
  tipo: TipoCampanha;
  inicio: string;
  fim: string;
  descricao: string;
  desconto: number | null;
  /** SKUs do catálogo do ERP. */
  produtos: string[];
};

/** Em ordem de início. */
export async function listarCampanhas(): Promise<Campanha[]> {
  const resposta = await api.get<{ data: Campanha[] }>('/campaigns');
  return resposta.data;
}

export function criarCampanha(input: CampanhaInput): Promise<Campanha> {
  return api.post<Campanha>('/campaigns', input);
}

export function atualizarCampanha(id: string, input: CampanhaInput): Promise<Campanha> {
  return api.put<Campanha>(`/campaigns/${id}`, input);
}

/** Visitas e próximas visitas vinculadas ficam sem a campanha. */
export async function excluirCampanha(id: string): Promise<void> {
  await api.del<void>(`/campaigns/${id}`);
}

/** As que o check-in pode vincular: programadas e em andamento (status do backend). */
export function campanhasNaoEncerradas(campanhas: Campanha[]): Campanha[] {
  return campanhas.filter((campanha) => campanha.status !== 'ENCERRADA');
}

/** As dos chips da Agenda. */
export function campanhasEmAndamento(campanhas: Campanha[]): Campanha[] {
  return campanhas.filter((campanha) => campanha.status === 'EM_ANDAMENTO');
}

/** Campos do formulário como texto (antes de aparar e converter). */
export type DadosCampanhaFormulario = { nome: string; inicio: string; fim: string; desconto: string };
export type ErrosCampanha = Partial<Record<keyof DadosCampanhaFormulario, string>>;

/** As mesmas regras do zod do backend (`campaign.schema.ts`), com as mesmas mensagens. */
export function validarCampanha(dados: DadosCampanhaFormulario): ErrosCampanha {
  const erros: ErrosCampanha = {};
  if (!dados.nome.trim()) erros.nome = 'Dê um nome à campanha.';
  if (!dados.inicio) erros.inicio = 'Informe a data de início.';
  if (!dados.fim) erros.fim = 'Informe a data de fim.';
  else if (dados.inicio && dados.fim < dados.inicio) erros.fim = 'A data de fim deve ser depois do início.';
  if (dados.desconto.trim() !== '' && !/^(100|[1-9]?\d)$/.test(dados.desconto.trim())) {
    erros.desconto = 'O desconto deve ser um número inteiro de 0 a 100.';
  }
  return erros;
}
