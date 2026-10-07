import { MAX_PRODUTOS_MAIS_COMPRADOS } from '../config/sazonalidade';
import { AppError } from '../errors/AppError';
import { ErrorCode } from '../errors/errorCodes';
import * as clientRepository from '../repositories/client.repository';
import type { ClienteParaAgenda } from '../repositories/client.repository';
import * as seasonalEventRepository from '../repositories/seasonal-event.repository';
import {
  dataCalendario,
  diasEntre,
  fimDoDia,
  inicioDoDia,
  somarDias,
  type DataCalendario,
} from './classificacao.service';
import { consultarItensBaixosEmLote, consultarVendas, erpSimulado } from './erp.service';
import {
  acaoPorVariacao,
  calcularVariacao,
  cruzarEstoqueComEventos,
  eventosNoHorizonte,
  janelaDoAnoAnterior,
  mediaNaJanela,
  montarTextoDaSugestao,
  periodoBase,
  produtosMaisComprados,
  totalNaJanela,
  vendasNaJanela,
  type AcaoSugerida,
  type AlertaProducao,
  type ClienteComEstoque,
  type EventoProximo,
  type Janela,
} from './insights.regras';

const MENSAGEM_CLIENTE_NAO_ENCONTRADO = 'Cliente não encontrado.';

/**
 * Insights sazonais do cliente (UC13) e alertas de produção do gestor (UC15):
 * busca os dados (repositórios e, via `erp.service`, o ERP), entrega às regras
 * puras de `insights.regras.ts` e projeta os DTOs — mesmo papel de
 * `agenda.service.ts` sobre `agenda.montagem.ts`. Não fala com o provedor de
 * ERP diretamente: indisponibilidade chega como `null` (vendas) ou em
 * `indisponiveis` (estoque), já registrada por `erp.service`.
 */
export type SugestaoDTO = {
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
  titulo: string;
  texto: string;
};

export type InsightsDTO =
  | {
      status: 'OK';
      simulado: boolean;
      horizonteDias: number;
      sugestoes: SugestaoDTO[];
      eventosSemHistorico: { id: string; nome: string; diasAteEvento: number }[];
    }
  | { status: 'SEM_ERP_ID' }
  | { status: 'INDISPONIVEL' };

/** Já serializável: datas em 'AAAA-MM-DD' e `atualizadoEm` em ISO. */
export type AlertaProducaoDTO = AlertaProducao;

export type AlertasDTO = {
  simulado: boolean;
  horizonteDias: number;
  eventos: { id: string; nome: string; dataEvento: string; diasAteEvento: number; produtosSugeridos: string[] }[];
  alertas: AlertaProducaoDTO[];
  /** Clientes ativos com `erpId`. */
  clientesConsultados: number;
  /** Dentre os consultados, os que ficaram sem resposta do ERP. */
  clientesIndisponiveis: number;
};

/** Eventos com `dataFim` em `[hoje, hoje + horizonteDias]`, do mais próximo ao mais distante. */
async function eventosDoHorizonte(hoje: DataCalendario, horizonteDias: number): Promise<EventoProximo[]> {
  const eventos = await seasonalEventRepository.findNoIntervalo(hoje, somarDias(hoje, horizonteDias));

  return eventosNoHorizonte(eventos, hoje, horizonteDias);
}

/**
 * Período da única consulta de vendas ao ERP: do primeiro dia da base mais
 * antiga ao último dia da janela mais recente, como instantes locais do dia
 * inteiro. Datas 'AAAA-MM-DD' comparam como texto na ordem do calendário.
 */
function periodoDaConsulta(comparacoes: { janela: Janela; base: Janela }[]): { inicio: Date; fim: Date } {
  const inicios = comparacoes.map(({ base }) => base.inicio);
  const fins = comparacoes.map(({ janela }) => janela.fim);

  return {
    inicio: inicioDoDia(inicios.reduce((menor, dia) => (dia < menor ? dia : menor))),
    fim: fimDoDia(fins.reduce((maior, dia) => (dia > maior ? dia : maior))),
  };
}

function arredondarCentavos(valor: number): number {
  return Math.round(valor * 100) / 100;
}

/**
 * Sugestões sazonais para o cliente (UC13): para cada evento do horizonte,
 * compara as compras na janela do mesmo evento no ano anterior com a média do
 * cliente no período de base. Todas as janelas e bases saem de uma única
 * consulta de vendas ao ERP; evento sem base ou sem compra na janela vai para
 * `eventosSemHistorico`. `erpId` desconhecido no ERP (vendas vazias) cai aí
 * para todos os eventos — não há status `NAO_ENCONTRADO`, porque a
 * pré-condição do UC13 é "histórico disponível". `hoje` é parametrizável para
 * os testes fixarem a data.
 */
export async function obterInsights(clientId: string, horizonteDias: number, hoje: Date = new Date()): Promise<InsightsDTO> {
  const cliente = await clientRepository.findById(clientId);
  if (!cliente) {
    throw new AppError(ErrorCode.NOT_FOUND, MENSAGEM_CLIENTE_NAO_ENCONTRADO, 404);
  }

  if (!cliente.erpId) {
    return { status: 'SEM_ERP_ID' };
  }

  const eventos = await eventosDoHorizonte(dataCalendario(hoje), horizonteDias);

  if (eventos.length === 0) {
    return { status: 'OK', simulado: erpSimulado(), horizonteDias, sugestoes: [], eventosSemHistorico: [] };
  }

  const comparacoes = eventos.map((evento) => {
    const janela = janelaDoAnoAnterior(evento.chave, Number(evento.dataEvento.slice(0, 4)));

    return { evento, janela, base: periodoBase(janela) };
  });

  const vendas = await consultarVendas(cliente.erpId, periodoDaConsulta(comparacoes));

  if (vendas === null) {
    return { status: 'INDISPONIVEL' };
  }

  const sugestoes: SugestaoDTO[] = [];
  const eventosSemHistorico: { id: string; nome: string; diasAteEvento: number }[] = [];

  for (const { evento, janela, base } of comparacoes) {
    const totalJanela = totalNaJanela(vendas, janela);
    const totalBase = totalNaJanela(vendas, base);
    const diasJanela = diasEntre(janela.inicio, janela.fim) + 1;
    const variacao = calcularVariacao(totalJanela, totalBase, diasJanela);

    if (variacao === null) {
      eventosSemHistorico.push({ id: evento.id, nome: evento.nome, diasAteEvento: evento.diasAteEvento });
      continue;
    }

    // A ação é decidida sobre o percentual já arredondado, para o número
    // exibido e a ação nunca discordarem (19,6% aparece como 20% e é AUMENTAR_OFERTA).
    const variacaoPercentual = Math.round(variacao * 100);
    const acao = acaoPorVariacao(variacaoPercentual / 100);
    const produtos = produtosMaisComprados(vendasNaJanela(vendas, janela), MAX_PRODUTOS_MAIS_COMPRADOS);
    const { titulo, texto } = montarTextoDaSugestao(evento, acao, variacaoPercentual, produtos);

    sugestoes.push({
      evento: {
        id: evento.id,
        nome: evento.nome,
        dataEvento: evento.dataEvento,
        diasAteEvento: evento.diasAteEvento,
      },
      acao,
      variacaoPercentual,
      periodoComparado: { inicio: janela.inicio, fim: janela.fim },
      comprasNaJanela: totalJanela,
      mediaNaJanela: arredondarCentavos(mediaNaJanela(totalBase, diasJanela)),
      produtosMaisComprados: produtos,
      titulo,
      texto,
    });
  }

  return { status: 'OK', simulado: erpSimulado(), horizonteDias, sugestoes, eventosSemHistorico };
}

/**
 * Alertas de produção do gestor (UC15): itens em estoque BAIXO, nos clientes
 * ativos com `erpId`, dos SKUs sugeridos para os eventos do horizonte. Sem
 * evento no horizonte não há o que cruzar, e nem clientes nem ERP são
 * consultados. Clientes cujo `erpId` o ERP não respondeu ficam fora do
 * cruzamento (não se sabe o estoque deles) e entram em
 * `clientesIndisponiveis`, para a tela avisar que a lista pode estar
 * incompleta.
 */
export async function obterAlertasDeProducao(horizonteDias: number, hoje: Date = new Date()): Promise<AlertasDTO> {
  const eventos = await eventosDoHorizonte(dataCalendario(hoje), horizonteDias);

  if (eventos.length === 0) {
    return {
      simulado: erpSimulado(),
      horizonteDias,
      eventos: [],
      alertas: [],
      clientesConsultados: 0,
      clientesIndisponiveis: 0,
    };
  }

  const clientes = (await clientRepository.listAtivosParaAgenda()).filter(
    (cliente): cliente is ClienteParaAgenda & { erpId: string } => Boolean(cliente.erpId),
  );
  const { itensPorErpId, indisponiveis } = await consultarItensBaixosEmLote(clientes.map((cliente) => cliente.erpId));
  const erpIdsIndisponiveis = new Set(indisponiveis);

  const clientesComEstoque: ClienteComEstoque[] = clientes
    .filter((cliente) => !erpIdsIndisponiveis.has(cliente.erpId))
    .map((cliente) => ({
      id: cliente.id,
      nomeFantasia: cliente.nomeFantasia,
      cidade: cliente.cidade,
      itensBaixos: itensPorErpId.get(cliente.erpId) ?? [],
    }));

  return {
    simulado: erpSimulado(),
    horizonteDias,
    eventos: eventos.map(({ id, nome, dataEvento, diasAteEvento, produtosSugeridos }) => ({
      id,
      nome,
      dataEvento,
      diasAteEvento,
      produtosSugeridos,
    })),
    alertas: cruzarEstoqueComEventos(clientesComEstoque, eventos),
    clientesConsultados: clientes.length,
    // Conta clientes, não `erpId`s: dois clientes com o mesmo `erpId` sem resposta são dois indisponíveis.
    clientesIndisponiveis: clientes.length - clientesComEstoque.length,
  };
}
