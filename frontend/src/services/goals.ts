/**
 * Acesso tipado às metas de visitas e vendas (spec 7.8). Espelha o
 * `MetaDTO` de `backend/src/services/goal.service.ts`: o realizado vem
 * calculado do backend (o front não recalcula regra). Todos leem (o
 * representante, só as próprias); criar, alterar e excluir é só do gestor no
 * backend. `periodoDaMeta` repete a regra do backend só para preencher o fim
 * no formulário — o backend recalcula.
 */
import { api } from './api';

export type PeriodoMeta = 'SEMANAL' | 'MENSAL' | 'PERSONALIZADO' | 'CAMPANHA';

export const ROTULO_PERIODO: Record<PeriodoMeta, string> = {
  SEMANAL: 'Semanal',
  MENSAL: 'Mensal',
  PERSONALIZADO: 'Período personalizado',
  CAMPANHA: 'Por campanha',
};

export type Meta = {
  id: string;
  representante: { id: string; nome: string };
  periodo: PeriodoMeta;
  /** `AAAA-MM-DD`, inclusivo. */
  inicio: string;
  /** `AAAA-MM-DD`, inclusivo. */
  fim: string;
  metaVisitas: number;
  /** Em reais. */
  metaVendas: number;
  campanhaId: string | null;
  /** Visitas do representante no período (na campanha, se for de campanha) e vendas (R$) das com VENDA. */
  realizado: { visitas: number; vendas: number };
};

/** Corpo de criar e de alterar (o `PUT` troca a meta inteira). */
export type MetaInput = {
  representanteId: string;
  periodo: PeriodoMeta;
  inicio: string;
  fim: string;
  metaVisitas: number;
  metaVendas: number;
  campanhaId: string | null;
};

export type FiltroMetas = { campanhaId?: string; representanteId?: string };

/** Sem `campanhaId`, só as metas sem campanha; com ele, só as daquela campanha. */
export async function listarMetas(filtro: FiltroMetas = {}): Promise<Meta[]> {
  const parametros = new URLSearchParams();
  if (filtro.campanhaId) parametros.set('campanhaId', filtro.campanhaId);
  if (filtro.representanteId) parametros.set('representanteId', filtro.representanteId);
  const consulta = parametros.toString();
  const resposta = await api.get<{ data: Meta[] }>(`/goals${consulta ? `?${consulta}` : ''}`);
  return resposta.data;
}

export function criarMeta(input: MetaInput): Promise<Meta> {
  return api.post<Meta>('/goals', input);
}

export function atualizarMeta(id: string, input: MetaInput): Promise<Meta> {
  return api.put<Meta>(`/goals/${id}`, input);
}

export async function excluirMeta(id: string): Promise<void> {
  await api.del<void>(`/goals/${id}`);
}

function somarDias(data: string, dias: number): string {
  const [ano, mes, dia] = data.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(ano, mes - 1, dia + dias)).toISOString().slice(0, 10);
}

/** Semanal: segunda a domingo da semana de `dataBase`; mensal: primeiro ao último dia do mês. */
export function periodoDaMeta(periodo: 'SEMANAL' | 'MENSAL', dataBase: string): { inicio: string; fim: string } {
  const [ano, mes] = dataBase.split('-').map(Number) as [number, number];
  if (periodo === 'SEMANAL') {
    const diaDaSemana = new Date(`${dataBase}T00:00:00.000Z`).getUTCDay();
    const inicio = somarDias(dataBase, -((diaDaSemana + 6) % 7));
    return { inicio, fim: somarDias(inicio, 6) };
  }
  const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const prefixo = dataBase.slice(0, 7);
  return { inicio: `${prefixo}-01`, fim: `${prefixo}-${String(ultimoDia).padStart(2, '0')}` };
}

/** Campos do formulário como texto (antes de converter). */
export type DadosMetaFormulario = {
  representanteId: string;
  inicio: string;
  fim: string;
  metaVisitas: string;
  metaVendas: string;
};
export type ErrosMeta = Partial<Record<keyof DadosMetaFormulario, string>>;

const MENSAGEM_META_VISITAS = 'A meta de visitas deve ser um número inteiro maior ou igual a 0.';
const MENSAGEM_META_VENDAS = 'A meta de vendas deve ser um valor maior ou igual a 0.';

/**
 * As mesmas regras do zod e do serviço do backend (`goal.schema.ts`,
 * `goal.service.ts`), com as mesmas mensagens. Com `campanha`, a meta tem de
 * caber no período dela.
 */
export function validarMeta(dados: DadosMetaFormulario, campanha?: { inicio: string; fim: string }): ErrosMeta {
  const erros: ErrosMeta = {};
  if (!dados.representanteId) erros.representanteId = 'Escolha um representante.';
  if (!dados.inicio) erros.inicio = 'Informe a data de início.';
  if (!dados.fim) erros.fim = 'Informe a data de fim.';
  else if (dados.inicio && dados.fim < dados.inicio) erros.fim = 'A data de fim deve ser depois do início.';
  if (campanha && dados.inicio && dados.fim && !erros.fim) {
    if (dados.inicio < campanha.inicio) erros.inicio = 'A meta deve ficar dentro do período da campanha.';
    if (dados.fim > campanha.fim) erros.fim = 'A meta deve ficar dentro do período da campanha.';
  }
  if (!/^\d+$/.test(dados.metaVisitas.trim())) erros.metaVisitas = MENSAGEM_META_VISITAS;
  const vendas = dados.metaVendas.trim().replace(',', '.');
  if (vendas === '' || !Number.isFinite(Number(vendas)) || Number(vendas) < 0) erros.metaVendas = MENSAGEM_META_VENDAS;
  return erros;
}
