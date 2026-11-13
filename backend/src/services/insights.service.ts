import { MAX_PRODUTOS_MAIS_COMPRADOS } from '../config/sazonalidade';
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
import { exigirClienteVisivel, type UsuarioAutenticado } from './carteira';
import {
  chaveDoCliente,
  consultarItensBaixosEmLote,
  consultarVendas,
  erpSimulado,
  estoqueDisponivel,
  fonteDoCliente,
} from './erp.service';
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
import { agora } from '../lib/relogio';

/**
 * Insights sazonais do cliente e alertas de produção do gestor:
 * busca os dados (repositórios e, via `erp.service`, o ERP), entrega às regras
 * puras de `insights.regras.ts` e projeta os DTOs (mesmo papel de
 * `agenda.service.ts` sobre `agenda.montagem.ts`). Não fala com o provedor de
 * ERP diretamente: indisponibilidade chega como `null` (vendas) ou em
 * `indisponiveis` (estoque), já registrada por `erp.service`; a chave do
 * cliente no ERP (`erpId` no mock, CNPJ no importado, `cnpj|erpId` no
 * híbrido) vem de `erp.service.chaveDoCliente`, e a fonte do cliente (notas,
 * simulado ou nenhuma) de `erp.service.fonteDoCliente`.
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
  /**
   * Clientes ativos com chave no ERP (no mock, os com `erpId`). No híbrido a
   * chave composta existe para todos: entram também os de fonte `nenhuma`
   * (e os de fonte `notas`), com estoque vazio.
   */
  clientesConsultados: number;
  /** Dentre os consultados, os que ficaram sem resposta do ERP. */
  clientesIndisponiveis: number;
  /** O ERP em uso não informa estoque (importado): não há alertas a calcular. */
  estoqueIndisponivel: boolean;
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
 * Quem chama garante ao menos uma comparação (há evento no horizonte); a
 * primeira dá o valor inicial das duas buscas.
 */
function periodoDaConsulta(comparacoes: { janela: Janela; base: Janela }[]): { inicio: Date; fim: Date } {
  const [primeira] = comparacoes;
  if (!primeira) {
    throw new Error('periodoDaConsulta exige ao menos uma comparação.');
  }

  return {
    inicio: inicioDoDia(
      comparacoes.reduce((menor, { base }) => (base.inicio < menor ? base.inicio : menor), primeira.base.inicio),
    ),
    fim: fimDoDia(
      comparacoes.reduce((maior, { janela }) => (janela.fim > maior ? janela.fim : maior), primeira.janela.fim),
    ),
  };
}

function arredondarCentavos(valor: number): number {
  return Math.round(valor * 100) / 100;
}

/**
 * Sugestões sazonais para o cliente: para cada evento do horizonte,
 * compara as compras na janela do mesmo evento no ano anterior com a média do
 * cliente no período de base. Todas as janelas e bases saem de uma única
 * consulta de vendas ao ERP; evento sem base ou sem compra na janela vai para
 * `eventosSemHistorico`. Chave desconhecida no ERP (vendas vazias) cai aí
 * para todos os eventos: não há status `NAO_ENCONTRADO`, porque os
 * insights pressupõem histórico disponível. Cliente de outra carteira
 * responde ao representante como inexistente (404). `hoje` é parametrizável
 * para os testes fixarem a data.
 */
export async function obterInsights(
  clientId: string,
  usuario: UsuarioAutenticado,
  horizonteDias: number,
  hoje: Date = agora(),
): Promise<InsightsDTO> {
  const cliente = exigirClienteVisivel(await clientRepository.findById(clientId), usuario);
  const chave = chaveDoCliente(cliente);

  // No híbrido a chave composta existe sempre; sem nota e sem `erpId` não há fonte.
  if (!chave || (await fonteDoCliente(cliente)) === 'nenhuma') {
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

  const vendas = await consultarVendas(chave, periodoDaConsulta(comparacoes));

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
      comprasNaJanela: arredondarCentavos(totalJanela),
      mediaNaJanela: arredondarCentavos(mediaNaJanela(totalBase, diasJanela)),
      produtosMaisComprados: produtos,
      titulo,
      texto,
    });
  }

  return { status: 'OK', simulado: erpSimulado(), horizonteDias, sugestoes, eventosSemHistorico };
}

/**
 * Alertas de produção do gestor: itens em estoque BAIXO, nos clientes
 * ativos com chave no ERP, dos SKUs sugeridos para os eventos do horizonte.
 * Sem evento no horizonte não há o que cruzar, e nem clientes nem ERP são
 * consultados; com o ERP sem estoque (importado), também não:
 * vão os eventos, nenhum alerta e `estoqueIndisponivel`. No híbrido o
 * estoque é por cliente: o de fonte `notas` devolve histórico vazio, então
 * entra sem item baixo (nem alerta, nem indisponível), e o
 * `estoqueIndisponivel` global fica falso. Clientes que o ERP
 * não respondeu ficam fora do cruzamento (não se sabe o estoque deles) e
 * entram em `clientesIndisponiveis`, para a tela avisar que a lista pode
 * estar incompleta. Com `representanteId`, só os clientes da carteira dele.
 */
export async function obterAlertasDeProducao(
  horizonteDias: number,
  hoje: Date = agora(),
  representanteId?: string,
): Promise<AlertasDTO> {
  const eventos = await eventosDoHorizonte(dataCalendario(hoje), horizonteDias);

  if (eventos.length === 0) {
    return {
      simulado: erpSimulado(),
      horizonteDias,
      eventos: [],
      alertas: [],
      clientesConsultados: 0,
      clientesIndisponiveis: 0,
      estoqueIndisponivel: !estoqueDisponivel(),
    };
  }

  const eventosDTO = eventos.map(({ id, nome, dataEvento, diasAteEvento, produtosSugeridos }) => ({
    id,
    nome,
    dataEvento,
    diasAteEvento,
    produtosSugeridos,
  }));

  if (!estoqueDisponivel()) {
    return {
      simulado: erpSimulado(),
      horizonteDias,
      eventos: eventosDTO,
      alertas: [],
      clientesConsultados: 0,
      clientesIndisponiveis: 0,
      estoqueIndisponivel: true,
    };
  }

  const clientes = (await clientRepository.listAtivosParaAgenda(representanteId)).flatMap(
    (cliente): (ClienteParaAgenda & { chave: string })[] => {
      const chave = chaveDoCliente(cliente);
      return chave ? [{ ...cliente, chave }] : [];
    },
  );
  const { itensPorChave, indisponiveis } = await consultarItensBaixosEmLote(clientes.map((cliente) => cliente.chave));
  const chavesIndisponiveis = new Set(indisponiveis);

  const clientesComEstoque: ClienteComEstoque[] = clientes
    .filter((cliente) => !chavesIndisponiveis.has(cliente.chave))
    .map((cliente) => ({
      id: cliente.id,
      nomeFantasia: cliente.nomeFantasia,
      cidade: cliente.cidade,
      itensBaixos: itensPorChave.get(cliente.chave) ?? [],
    }));

  return {
    simulado: erpSimulado(),
    horizonteDias,
    eventos: eventosDTO,
    alertas: cruzarEstoqueComEventos(clientesComEstoque, eventos),
    clientesConsultados: clientes.length,
    // Conta clientes, não chaves: dois clientes com a mesma chave sem resposta são dois indisponíveis.
    clientesIndisponiveis: clientes.length - clientesComEstoque.length,
    estoqueIndisponivel: false,
  };
}
