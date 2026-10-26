import { Prisma, type ResultadoVisita } from '@prisma/client';
import { CORES_INATIVAS, DIAS_MAXIMOS_DO_RITMO_SEMANAL, PERIODO_PADRAO_DIAS } from '../config/kpis';
import { CORES, dataCalendario, diasEntre, somarDias, type Cor, type DataCalendario } from './classificacao.service';

/**
 * Regras puras dos indicadores do painel do gestor (UC14) — mesmo papel de
 * `agenda.montagem.ts` e `insights.regras.ts`: nenhuma dependência de banco
 * nem de provider. Quem busca os dados (`kpis.service.ts`) importa daqui,
 * nunca o contrário.
 */
export type VisitaDoPeriodo = { clientId: string; resultado: ResultadoVisita };

/** Sempre as quatro cores como chave, zeradas quando não há clientes. */
export type DistribuicaoPorCor = Record<Cor, number>;

/** `percentual` é inteiro arredondado; `null` quando o denominador é 0. */
export type Proporcao = { numerador: number; denominador: number; percentual: number | null };

export function proporcao(numerador: number, denominador: number): Proporcao {
  return {
    numerador,
    denominador,
    percentual: denominador === 0 ? null : Math.round((numerador / denominador) * 100),
  };
}

/** [hoje − (periodoDias − 1), hoje] — 30 dias inclui hoje; usado com inicioDoDia/fimDoDia para os instantes. */
export function periodoDeAnalise(
  hoje: DataCalendario,
  periodoDias: number,
): { inicio: DataCalendario; fim: DataCalendario } {
  return { inicio: somarDias(hoje, -(periodoDias - 1)), fim: hoje };
}

/** Janela de análise já resolvida: `dias` conta as duas pontas; `inicio` e `fim` em 'AAAA-MM-DD', inclusivos. */
export type Janela = { dias: number; inicio: DataCalendario; fim: DataCalendario };

/**
 * A janela pedida: com `inicio` e `fim`, as datas (e `dias` = `diasEntre` + 1);
 * com `periodoDias`, os últimos dias terminando hoje; sem nada, 30 dias. Pura:
 * não valida — quem confere as datas é `resolverPeriodo` (periodo.ts).
 */
export function janelaDoPeriodo(
  pedido: { periodoDias?: number | undefined; inicio?: DataCalendario | undefined; fim?: DataCalendario | undefined },
  hoje: DataCalendario,
): Janela {
  if (pedido.inicio !== undefined && pedido.fim !== undefined) {
    return { dias: diasEntre(pedido.inicio, pedido.fim) + 1, inicio: pedido.inicio, fim: pedido.fim };
  }

  const dias = pedido.periodoDias ?? PERIODO_PADRAO_DIAS;
  return { dias, ...periodoDeAnalise(hoje, dias) };
}

export function contarVisitas(visitas: VisitaDoPeriodo[]): number {
  return visitas.length;
}

/** totalVisitas (todas as do período) ÷ clientesAtivos, 1 casa decimal; null quando clientesAtivos = 0. */
export function mediaDeVisitasPorCliente(totalVisitas: number, clientesAtivos: number): number | null {
  if (clientesAtivos === 0) return null;

  return Math.round((totalVisitas / clientesAtivos) * 10) / 10;
}

/** Clientes ativos com ≥ 1 visita OU ≥ 1 mensagem no período (cada cliente conta uma vez); percentual inteiro arredondado; null se denominador = 0. */
export function taxaDeRegistro(
  visitas: VisitaDoPeriodo[],
  mensagens: { clientId: string }[],
  clientesAtivosIds: string[],
): Proporcao {
  const comRegistro = new Set([...visitas.map((v) => v.clientId), ...mensagens.map((m) => m.clientId)]);
  const registrados = clientesAtivosIds.filter((id) => comRegistro.has(id));

  return proporcao(new Set(registrados).size, clientesAtivosIds.length);
}

/** Visitas com resultado VENDA ÷ visitas do período; null sem visitas. */
export function conversaoEmVendas(visitas: VisitaDoPeriodo[]): Proporcao {
  const vendas = visitas.filter((v) => v.resultado === 'VENDA').length;

  return proporcao(vendas, visitas.length);
}

export function distribuicaoPorCor(cores: Cor[]): DistribuicaoPorCor {
  const distribuicao = Object.fromEntries(CORES.map((cor) => [cor, 0])) as DistribuicaoPorCor;

  for (const cor of cores) distribuicao[cor] += 1;

  return distribuicao;
}

/** Soma das cores de `CORES_INATIVAS`. */
export function contarInativos(distribuicao: DistribuicaoPorCor): number {
  return CORES_INATIVAS.reduce((total, cor) => total + distribuicao[cor], 0);
}

/** Um cliente da carteira com as visitas dele no período, repartidas pelo resultado. */
export type ClienteDoRepresentante = {
  id: string;
  nomeFantasia: string;
  vendas: number;
  negociacoes: number;
  semVenda: number;
};

/**
 * Linha do comparativo por representante: números da carteira dele no
 * período. `vendas`, `negociacoes` e `semVenda` repartem `visitas` pelo
 * resultado (a barra empilhada "Resultado das visitas por representante").
 * `receita` é o total, em R$, dos pedidos das visitas com resultado VENDA;
 * `clientes` são os clientes com ao menos uma visita no período (o detalhe
 * de cada fatia da barra).
 */
export type KpiRepresentante = {
  id: string;
  nome: string;
  clientesAtivos: number;
  visitas: number;
  vendas: number;
  negociacoes: number;
  semVenda: number;
  conversaoEmVendas: Proporcao;
  receita: number;
  clientes: ClienteDoRepresentante[];
};

function contarResultado(visitas: VisitaDoPeriodo[], resultado: ResultadoVisita): number {
  return visitas.filter((visita) => visita.resultado === resultado).length;
}

function porNome(a: string, b: string): number {
  return a.localeCompare(b, 'pt-BR');
}

function totalDoCliente(cliente: ClienteDoRepresentante): number {
  return cliente.vendas + cliente.negociacoes + cliente.semVenda;
}

/** Agrupa as visitas por cliente: do que tem mais visitas ao que tem menos e, no empate, por nome. */
function agruparPorCliente(visitas: (VisitaDoPeriodo & { clienteNome: string })[]): ClienteDoRepresentante[] {
  const porCliente = new Map<string, (VisitaDoPeriodo & { clienteNome: string })[]>();

  for (const visita of visitas) {
    porCliente.set(visita.clientId, [...(porCliente.get(visita.clientId) ?? []), visita]);
  }

  return [...porCliente.entries()]
    .map(([id, visitasDoCliente]) => ({
      id,
      nomeFantasia: visitasDoCliente[0]!.clienteNome,
      vendas: contarResultado(visitasDoCliente, 'VENDA'),
      negociacoes: contarResultado(visitasDoCliente, 'NEGOCIACAO'),
      semVenda: contarResultado(visitasDoCliente, 'SEM_VENDA'),
    }))
    .sort((a, b) => totalDoCliente(b) - totalDoCliente(a) || porNome(a.nomeFantasia, b.nomeFantasia));
}

/**
 * Indicadores por representante, pela carteira do cliente (não pelo autor da
 * visita). Todo representante de `representantes` aparece, mesmo sem cliente
 * nem visita; visitas de carteira fora da lista são ignoradas. `totalPedido`
 * é o valor do pedido da visita; só as de VENDA entram na `receita`, somada
 * em `Decimal` e arredondada a 2 casas. Ordem: `visitas` desc, depois `nome`.
 */
export function agruparPorRepresentante(
  visitas: (VisitaDoPeriodo & {
    representanteId: string;
    clienteNome: string;
    totalPedido: Prisma.Decimal.Value;
  })[],
  clientes: { representanteId: string }[],
  representantes: { id: string; nome: string }[],
): KpiRepresentante[] {
  return representantes
    .map(({ id, nome }) => {
      const visitasDaCarteira = visitas.filter((visita) => visita.representanteId === id);
      const receita = visitasDaCarteira
        .filter((visita) => visita.resultado === 'VENDA')
        .reduce((soma, visita) => soma.plus(visita.totalPedido), new Prisma.Decimal(0));

      return {
        id,
        nome,
        clientesAtivos: clientes.filter((cliente) => cliente.representanteId === id).length,
        visitas: visitasDaCarteira.length,
        vendas: contarResultado(visitasDaCarteira, 'VENDA'),
        negociacoes: contarResultado(visitasDaCarteira, 'NEGOCIACAO'),
        semVenda: contarResultado(visitasDaCarteira, 'SEM_VENDA'),
        conversaoEmVendas: conversaoEmVendas(visitasDaCarteira),
        receita: receita.toDecimalPlaces(2).toNumber(),
        clientes: agruparPorCliente(visitasDaCarteira),
      };
    })
    .sort((a, b) => b.visitas - a.visitas || porNome(a.nome, b.nome));
}

/** Segunda-feira da semana de `data` (a própria, se já for segunda). */
function segundaDaSemana(data: DataCalendario): DataCalendario {
  const diaDaSemana = new Date(`${data}T00:00:00.000Z`).getUTCDay(); // 0 = domingo

  return somarDias(data, -((diaDaSemana + 6) % 7));
}

/** Um cliente numa faixa do ritmo: quantas visitas teve nela e, delas, quantas com resultado VENDA. */
export type ClienteNaFatia = { id: string; nomeFantasia: string; visitas: number; vendas: number };

/**
 * Uma faixa (semana ou mês) do ritmo de visitas. `inicio` e `fim` são os da
 * semana (segunda a domingo) ou do mês inteiros; `parcial` diz que só parte
 * dela cabe na janela (o corte não aparece em `inicio` nem em `fim`).
 */
export type FaixaDoRitmo = {
  inicio: DataCalendario;
  fim: DataCalendario;
  parcial: boolean;
  visitas: number;
  vendas: number;
  clientes: ClienteNaFatia[];
};

export type Ritmo = { granularidade: 'SEMANA' | 'MES'; faixas: FaixaDoRitmo[] };

export type VisitaDoRitmo = { clientId: string; clienteNome: string; dataHora: Date; resultado: ResultadoVisita };

/** Primeiro dia do mês seguinte ao de `data`. */
function primeiroDiaDoMesSeguinte(data: DataCalendario): DataCalendario {
  const ano = Number(data.slice(0, 4));
  const mes = Number(data.slice(5, 7));

  return new Date(Date.UTC(ano, mes, 1)).toISOString().slice(0, 10);
}

/** Semanas (segunda a domingo) ou meses inteiros, em ordem, que cruzam a janela. */
function faixasQueCruzam(
  janela: Janela,
  granularidade: Ritmo['granularidade'],
): { inicio: DataCalendario; fim: DataCalendario }[] {
  const faixas: { inicio: DataCalendario; fim: DataCalendario }[] = [];
  let inicio = granularidade === 'SEMANA' ? segundaDaSemana(janela.inicio) : `${janela.inicio.slice(0, 7)}-01`;

  while (inicio <= janela.fim) {
    const proximo = granularidade === 'SEMANA' ? somarDias(inicio, 7) : primeiroDiaDoMesSeguinte(inicio);
    faixas.push({ inicio, fim: somarDias(proximo, -1) });
    inicio = proximo;
  }

  return faixas;
}

/**
 * Ritmo de visitas do Painel na janela de análise: até
 * `DIAS_MAXIMOS_DO_RITMO_SEMANAL` dias, uma faixa por semana (segunda a
 * domingo); acima disso, uma por mês. Entram todas as faixas que cruzam a
 * janela, com zero nas sem visita. Cada visita conta no seu dia de calendário
 * no `FUSO_HORARIO`; a de fora da janela é ignorada. `vendas` conta só as
 * visitas com resultado VENDA; `clientes` são os visitados na faixa.
 */
export function ritmoNoPeriodo(visitas: VisitaDoRitmo[], janela: Janela): Ritmo {
  const granularidade = janela.dias <= DIAS_MAXIMOS_DO_RITMO_SEMANAL ? 'SEMANA' : 'MES';
  const faixas = faixasQueCruzam(janela, granularidade).map((faixa) => ({
    ...faixa,
    parcial: faixa.inicio < janela.inicio || faixa.fim > janela.fim,
    visitasDaFaixa: [] as VisitaDoRitmo[],
  }));

  for (const visita of visitas) {
    const dia = dataCalendario(visita.dataHora);
    if (dia < janela.inicio || dia > janela.fim) continue;

    faixas.find((faixa) => faixa.inicio <= dia && dia <= faixa.fim)?.visitasDaFaixa.push(visita);
  }

  return {
    granularidade,
    faixas: faixas.map(({ visitasDaFaixa, ...faixa }) => ({
      ...faixa,
      visitas: visitasDaFaixa.length,
      vendas: contarResultado(visitasDaFaixa, 'VENDA'),
      clientes: agruparPorCliente(visitasDaFaixa).map((cliente) => ({
        id: cliente.id,
        nomeFantasia: cliente.nomeFantasia,
        visitas: totalDoCliente(cliente),
        vendas: cliente.vendas,
      })),
    })),
  };
}
