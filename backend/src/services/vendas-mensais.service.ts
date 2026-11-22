import * as clientRepository from '../repositories/client.repository';
import { dataCalendario, fimDoDia, inicioDoDia, type DataCalendario } from './classificacao.service';
import { chaveDoCliente, consultarVendasEmLote, erpSimulado } from './erp.service';
import type { Janela } from './kpis.regras';
import { eventosDoHorizonte } from './insights.service';
import {
  estenderMesesAte,
  marcadoresDeEventos,
  marcarMesesFuturos,
  mesesDaJanela,
  serieMensal,
  ultimoDiaDoMes,
  type MarcadorDeEvento,
  type PontoMensalDTO,
  type VendasDeUmCliente,
} from './vendas-mensais.regras';
import { agora } from '../lib/relogio';

/**
 * Vendas mensais da carteira (gráfico do painel do gestor): busca os
 * clientes ativos, consulta no ERP (via `erp.service`) as vendas dos meses
 * do período pedido de cada um e entrega às regras puras de `vendas-mensais.regras.ts`.
 * ERP indisponível não derruba a resposta: o cliente afetado fica fora da
 * soma e é contado em `clientesIndisponiveis`.
 */
export type VendasMensaisDTO = {
  /** O período pedido, já resolvido (dias e datas de início e fim). */
  periodo: { dias: number; inicio: DataCalendario; fim: DataCalendario };
  /**
   * Os meses ('AAAA-MM') do início ao fim do período (no mínimo
   * `MESES_MINIMOS_DO_GRAFICO`), do mais antigo ao mais recente; com
   * `ateProximaData`, seguidos dos meses até o da próxima data comemorativa,
   * os futuros com `futuro: true` e sem valor.
   */
  meses: PontoMensalDTO[];
  /** Eventos sazonais que caem nesses meses, por data. */
  eventos: MarcadorDeEvento[];
  simulado: boolean;
  /**
   * Clientes ativos com chave no ERP (os que ele pode responder: no mock, os
   * com `erpId`; no importado e no híbrido, todos; no híbrido, os de fonte
   * `nenhuma` entram com vendas vazias).
   */
  clientesConsultados: number;
  /** Dos consultados, quantos o ERP não conseguiu responder. */
  clientesIndisponiveis: number;
  /** A data comemorativa até cujo mês a série foi estendida; `null` sem a opção, com o período no passado ou sem data no horizonte. */
  proximaData: { id: string; nome: string; chave: string; data: DataCalendario } | null;
};

/**
 * Estende a série até o mês da próxima data comemorativa em até
 * `horizonteDias` dias, só quando o período termina no mês de hoje; com o
 * período no passado, a opção é ignorada (`proximaData` nula).
 */
export type OpcoesDaSerie = { ateProximaData?: { horizonteDias: number } };

/**
 * Com `representanteId`, só a carteira daquele representante; sem ele, a
 * empresa toda. O período no ERP vai de 00:00 do primeiro dia do mês mais
 * antigo ao fim do último dia do mais recente (ou de hoje, se o mês é o atual
 * ou futuro): a série estendida não faz consulta a mais ao ERP.
 */
export async function obterVendasMensais(
  janela: Janela,
  hoje: Date = agora(),
  representanteId?: string,
  opcoes: OpcoesDaSerie = {},
): Promise<VendasMensaisDTO> {
  const hojeCal = dataCalendario(hoje);
  const mesesDoPeriodo = mesesDaJanela(janela);
  // Só o período que termina no mês de hoje se estende: um período no passado ignora a opção.
  const terminaNoMesDeHoje = mesesDoPeriodo[mesesDoPeriodo.length - 1] === hojeCal.slice(0, 7);
  const [proxima] =
    opcoes.ateProximaData && terminaNoMesDeHoje
      ? await eventosDoHorizonte(hojeCal, opcoes.ateProximaData.horizonteDias)
      : [];
  const meses = proxima ? estenderMesesAte(mesesDoPeriodo, proxima.dataEvento.slice(0, 7)) : mesesDoPeriodo;
  const ultimoDia = ultimoDiaDoMes(meses[meses.length - 1] as string);

  const ativos = await clientRepository.listAtivosParaAgenda(representanteId);
  const consultados = ativos.flatMap((cliente) => {
    const chave = chaveDoCliente(cliente);
    return chave ? [{ cliente, chave }] : [];
  });
  const chaves = consultados.map(({ chave }) => chave);

  const { vendasPorChave, indisponiveis } = await consultarVendasEmLote(chaves, {
    inicio: inicioDoDia(`${meses[0]}-01`),
    fim: fimDoDia(ultimoDia < hojeCal ? ultimoDia : hojeCal),
  });

  // Liga as vendas de cada chave ao cliente; quem o ERP não respondeu fica fora.
  const vendasPorCliente: VendasDeUmCliente[] = consultados.flatMap(({ cliente: { id, nomeFantasia }, chave }) => {
    const vendas = vendasPorChave.get(chave);
    return vendas ? [{ cliente: { id, nomeFantasia }, vendas }] : [];
  });

  return {
    periodo: { dias: janela.dias, inicio: janela.inicio, fim: janela.fim },
    meses: marcarMesesFuturos(serieMensal(vendasPorCliente, meses), hojeCal.slice(0, 7)),
    eventos: marcadoresDeEventos(meses),
    simulado: erpSimulado(),
    clientesConsultados: chaves.length,
    clientesIndisponiveis: chaves.filter((chave) => indisponiveis.includes(chave)).length,
    proximaData: proxima
      ? { id: proxima.id, nome: proxima.nome, chave: proxima.chave, data: proxima.dataEvento }
      : null,
  };
}
