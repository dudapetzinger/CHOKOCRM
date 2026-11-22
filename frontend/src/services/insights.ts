/**
 * Acesso tipado aos insights das datas comemorativas do cliente e às datas
 * comemorativas do Painel (aba "Produção e sazonalidade"). Espelha os shapes de
 * `InsightsDTO` e `SugestaoDTO` de `backend/src/services/insights.service.ts`
 * e a resposta de `sazonalidade-painel.service.ts`. Datas de calendário chegam como
 * 'AAAA-MM-DD' (formatar com `formatarDataCalendario`).
 */
import { api } from './api';
import type { TipoCampanha } from './campaigns';

export type AcaoSugerida = 'AUMENTAR_OFERTA' | 'MANTER_OFERTA' | 'OFERTAR_DESCONTO';

/** Campanha, promoção ou evento que cobre o período da data; datas 'AAAA-MM-DD', ordem por início. */
export type CampanhaDaSugestao = {
  id: string;
  nome: string;
  tipo: TipoCampanha;
  inicio: string;
  fim: string;
  /** Percentual inteiro, ou nulo quando não há desconto. */
  desconto: number | null;
  situacao: 'EM_ANDAMENTO' | 'PROGRAMADA';
};

export type Sugestao = {
  /** `dataEvento` em 'AAAA-MM-DD'. */
  evento: { id: string; nome: string; dataEvento: string; diasAteEvento: number };
  acao: AcaoSugerida;
  /** Inteiro arredondado: 85, -30. */
  variacaoPercentual: number;
  /** Janela do mesmo evento no ano anterior, 'AAAA-MM-DD'. */
  periodoComparado: { inicio: string; fim: string };
  /** R$ comprados na janela do ano anterior. */
  comprasNaJanela: number;
  /** R$ que o cliente compraria no ritmo do período de base, para a mesma duração da janela. */
  mediaNaJanela: number;
  produtosMaisComprados: { sku: string; nome: string; quantidade: number }[];
  campanhas: CampanhaDaSugestao[];
  titulo: string;
  texto: string;
};

export type Insights =
  | {
      status: 'OK';
      simulado: boolean;
      horizonteDias: number;
      sugestoes: Sugestao[];
      eventosSemHistorico: { id: string; nome: string; diasAteEvento: number; campanhas: CampanhaDaSugestao[] }[];
    }
  | { status: 'SEM_ERP_ID' }
  | { status: 'INDISPONIVEL' };

/** Cliente com estoque baixo de um produto: a quantidade é a do snapshot mais recente, em unidades. */
export type ClienteComEstoqueBaixo = { id: string; nomeFantasia: string; cidade: string; quantidade: number };

/** Um produto indicado para a data, com os clientes abaixo do limite (da menor quantidade à maior). */
export type EstoqueBaixoDoProduto = {
  sku: string;
  nome: string;
  totalClientes: number;
  clientes: ClienteComEstoqueBaixo[];
};

/** Uma data comemorativa do horizonte, com as vendas, as campanhas e o estoque baixo do período dela. */
export type DataDaSazonalidade = {
  id: string;
  /** Com o ano: "Natal 2026". */
  nome: string;
  chave: string;
  /** 'AAAA-MM-DD'. */
  data: string;
  diasAte: number;
  /** Período de vendas deste ano (30 dias antes da data até ela), 'AAAA-MM-DD'. */
  janela: { inicio: string; fim: string };
  /** O mesmo período no ano anterior, 'AAAA-MM-DD'. */
  janelaAnoAnterior: { inicio: string; fim: string };
  /** R$ vendidos pela carteira no período do ano anterior. */
  vendasAnoAnterior: number;
  /** R$ vendidos do início do período até hoje; nulo enquanto o período não começou. */
  vendasNaJanelaAtual: number | null;
  campanhas: CampanhaDaSugestao[];
  /** Clientes baixos em pelo menos um produto da data, cada um contado uma vez. */
  clientesComEstoqueBaixo: number;
  /** Um item por produto indicado, do que tem mais clientes baixos ao que tem menos. */
  estoqueBaixo: EstoqueBaixoDoProduto[];
};

/**
 * As datas comemorativas do horizonte, da mais próxima à mais distante, e as
 * contagens da carteira. Sem nenhuma data, as contagens não dizem nada.
 */
export type Sazonalidade = {
  /** 'AAAA-MM-DD', o "hoje" do sistema. */
  hoje: string;
  horizonteDias: number;
  simulado: boolean;
  /** Estoque baixo é uma quantidade abaixo deste número de unidades. */
  limiteEstoqueBaixo: number;
  clientesDaCarteira: number;
  clientesConsultados: number;
  /** Clientes que informam estoque: o "M" de "N de M clientes". */
  clientesComEstoque: number;
  /** O ERP em uso não informa o estoque de nenhum cliente. */
  estoqueIndisponivel: boolean;
  /** Clientes que o ERP não respondeu, fora das somas e das contagens. */
  clientesIndisponiveis: { vendas: number; estoque: number };
  datas: DataDaSazonalidade[];
};

export function buscarInsights(clienteId: string, horizonteDias: number): Promise<Insights> {
  return api.get<Insights>(`/clients/${clienteId}/insights?horizonteDias=${horizonteDias}`);
}

/** `representanteId` só faz efeito para o gestor; vai na query só quando definido. */
export function buscarSazonalidade(horizonteDias: number, representanteId?: string): Promise<Sazonalidade> {
  const query = new URLSearchParams({ horizonteDias: String(horizonteDias) });
  if (representanteId) {
    query.set('representanteId', representanteId);
  }
  return api.get<Sazonalidade>(`/insights/sazonalidade?${query}`);
}
