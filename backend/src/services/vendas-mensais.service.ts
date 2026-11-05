import * as clientRepository from '../repositories/client.repository';
import { dataCalendario, fimDoDia, inicioDoDia, type DataCalendario } from './classificacao.service';
import { chaveDoCliente, consultarVendasEmLote, erpSimulado } from './erp.service';
import type { Janela } from './kpis.regras';
import {
  marcadoresDeEventos,
  mesesDaJanela,
  serieMensal,
  ultimoDiaDoMes,
  type MarcadorDeEvento,
  type PontoMensal,
  type VendasDeUmCliente,
} from './vendas-mensais.regras';
import { agora } from '../lib/relogio';

/**
 * Vendas mensais da carteira (gráfico do painel do gestor, Etapa 7): busca os
 * clientes ativos, consulta no ERP (via `erp.service`) as vendas dos meses
 * do período pedido (Etapa 11) de cada um e entrega às regras puras de `vendas-mensais.regras.ts`.
 * ERP indisponível não derruba a resposta: o cliente afetado fica fora da
 * soma e é contado em `clientesIndisponiveis`.
 */
export type VendasMensaisDTO = {
  /** O período pedido, já resolvido (dias e datas de início e fim). */
  periodo: { dias: number; inicio: DataCalendario; fim: DataCalendario };
  /** Os meses ('AAAA-MM') do início ao fim do período (no mínimo `MESES_MINIMOS_DO_GRAFICO`), do mais antigo ao mais recente. */
  meses: PontoMensal[];
  /** Eventos sazonais que caem nesses meses, por data. */
  eventos: MarcadorDeEvento[];
  simulado: boolean;
  /** Clientes ativos com chave no ERP (os que ele pode responder: no mock, os com `erpId`; no importado, todos). */
  clientesConsultados: number;
  /** Dos consultados, quantos o ERP não conseguiu responder. */
  clientesIndisponiveis: number;
};

/**
 * Com `representanteId`, só a carteira daquele representante; sem ele, a
 * empresa toda. O período no ERP vai de 00:00 do primeiro dia do mês mais
 * antigo ao fim do último dia do mais recente (ou de hoje, se o mês é o atual).
 */
export async function obterVendasMensais(
  janela: Janela,
  hoje: Date = agora(),
  representanteId?: string,
): Promise<VendasMensaisDTO> {
  const hojeCal = dataCalendario(hoje);
  const meses = mesesDaJanela(janela);
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
    meses: serieMensal(vendasPorCliente, meses),
    eventos: marcadoresDeEventos(meses),
    simulado: erpSimulado(),
    clientesConsultados: chaves.length,
    clientesIndisponiveis: chaves.filter((chave) => indisponiveis.includes(chave)).length,
  };
}
