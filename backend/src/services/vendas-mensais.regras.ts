import { MESES_MINIMOS_DO_GRAFICO } from '../config/kpis';
import { dataDoEvento, EVENTOS_SAZONAIS, NOME_DO_EVENTO, type EventoSazonal } from '../config/sazonalidade';
import type { Sale } from '../providers/erp/ErpProvider';
import { dataCalendario, type DataCalendario } from './classificacao.service';
import type { Janela } from './kpis.regras';

/**
 * Regras puras do gráfico de vendas mensais da carteira, com o mesmo
 * papel de `kpis.regras.ts`: nenhuma dependência de banco nem de provider.
 * Quem busca as vendas (`vendas-mensais.service.ts`) importa daqui. Mês é
 * sempre `'AAAA-MM'` do dia de calendário no `FUSO_HORARIO`. A janela de
 * meses segue o período do painel, com piso de `MESES_MINIMOS_DO_GRAFICO`.
 */
export type TotalDoMes = { mes: string; total: number };

/** Um cliente que comprou no mês, com o quanto comprou. */
export type ClienteNoMes = { id: string; nomeFantasia: string; total: number };

export type PontoMensal = TotalDoMes & { clientesComDados: number; clientes: ClienteNoMes[] };

/** As vendas de um cliente da carteira, já ligado ao cadastro. */
export type VendasDeUmCliente = { cliente: { id: string; nomeFantasia: string }; vendas: Sale[] };

export type MarcadorDeEvento = { chave: EventoSazonal; nome: string; data: DataCalendario };

function pad2(numero: number): string {
  return numero.toString().padStart(2, '0');
}

function mesDaVenda(venda: Sale): string {
  return dataCalendario(venda.data).slice(0, 7);
}

/** Arredonda valores monetários a 2 casas. */
function emCentavos(valor: number): number {
  return Math.round(valor * 100) / 100;
}

/**
 * Os meses ('AAAA-MM') da janela, do mês do início ao mês do fim, do mais
 * antigo ao mais recente. Janela curta é estendida para trás até `minimo`
 * meses (o último mês continua sendo o do fim), para o gráfico não ficar
 * com um ou dois pontos.
 */
export function mesesDaJanela(janela: Pick<Janela, 'inicio' | 'fim'>, minimo = MESES_MINIMOS_DO_GRAFICO): string[] {
  const anoDoInicio = Number(janela.inicio.slice(0, 4));
  const mesDoInicio = Number(janela.inicio.slice(5, 7));
  const anoDoFim = Number(janela.fim.slice(0, 4));
  const mesDoFim = Number(janela.fim.slice(5, 7));

  const quantidade = Math.max((anoDoFim - anoDoInicio) * 12 + (mesDoFim - mesDoInicio) + 1, minimo);

  return Array.from({ length: quantidade }, (_, i) => {
    const primeiroDia = new Date(Date.UTC(anoDoFim, mesDoFim - 1 - (quantidade - 1 - i), 1));
    return `${primeiroDia.getUTCFullYear()}-${pad2(primeiroDia.getUTCMonth() + 1)}`;
  });
}

/** Soma de `valor` por mês, uma entrada por mês de `meses`, na ordem; mês sem venda fica com 0; vendas fora de `meses` são ignoradas. */
export function somarPorMes(vendas: Sale[], meses: string[]): TotalDoMes[] {
  const somas = new Map(meses.map((mes) => [mes, 0]));

  for (const venda of vendas) {
    const mes = mesDaVenda(venda);
    const soma = somas.get(mes);
    if (soma !== undefined) somas.set(mes, soma + venda.valor);
  }

  return meses.map((mes) => ({ mes, total: emCentavos(somas.get(mes) ?? 0) }));
}

/**
 * Série do gráfico: total de todas as vendas por mês (`somarPorMes`) e,
 * em `clientesComDados`, quantos clientes tiveram ao menos uma venda no mês.
 * Em `clientes`, só quem comprou no mês, do maior total ao menor e, no
 * empate, por nome; mês sem venda fica com a lista vazia.
 */
export function serieMensal(vendasPorCliente: VendasDeUmCliente[], meses: string[]): PontoMensal[] {
  const dosClientes = vendasPorCliente.map(({ cliente, vendas }) => ({
    cliente,
    mesesComVenda: new Set(vendas.map(mesDaVenda)),
    totais: somarPorMes(vendas, meses),
  }));

  return somarPorMes(
    vendasPorCliente.flatMap(({ vendas }) => vendas),
    meses,
  ).map(({ mes, total }, indice) => {
    const clientes = dosClientes
      .filter(({ mesesComVenda }) => mesesComVenda.has(mes))
      .map(({ cliente, totais }) => ({
        id: cliente.id,
        nomeFantasia: cliente.nomeFantasia,
        total: totais[indice]!.total,
      }))
      .sort((a, b) => b.total - a.total || a.nomeFantasia.localeCompare(b.nomeFantasia, 'pt-BR'));

    return { mes, total, clientesComDados: clientes.length, clientes };
  });
}

/** Último dia (`'AAAA-MM-DD'`) do mês `'AAAA-MM'`. */
export function ultimoDiaDoMes(mes: string): DataCalendario {
  const ultimo = new Date(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0));
  return ultimo.toISOString().slice(0, 10);
}

/**
 * Eventos sazonais que caem nos `meses` (de `mesesDaJanela`), do primeiro
 * dia do mês mais antigo ao último dia do mais recente, em todos os anos
 * que os meses cobrem; ordenados por data.
 */
export function marcadoresDeEventos(meses: string[]): MarcadorDeEvento[] {
  const primeiro = meses[0] as string;
  const ultimo = meses[meses.length - 1] as string;
  const inicio = `${primeiro}-01`;
  const fim = ultimoDiaDoMes(ultimo);
  const anoInicial = Number(primeiro.slice(0, 4));
  const anoFinal = Number(ultimo.slice(0, 4));
  const anos = Array.from({ length: anoFinal - anoInicial + 1 }, (_, i) => anoInicial + i);

  return anos
    .flatMap((anoDoEvento) =>
      EVENTOS_SAZONAIS.map((chave) => ({ chave, nome: NOME_DO_EVENTO[chave], data: dataDoEvento(chave, anoDoEvento) })),
    )
    .filter(({ data }) => data >= inicio && data <= fim)
    .sort((a, b) => a.data.localeCompare(b.data));
}
