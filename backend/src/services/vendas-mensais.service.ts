import * as clientRepository from '../repositories/client.repository';
import { dataCalendario, fimDoDia, inicioDoDia } from './classificacao.service';
import { consultarVendasEmLote, erpSimulado } from './erp.service';
import {
  marcadoresDeEventos,
  mesesDaJanela,
  serieMensal,
  type MarcadorDeEvento,
  type PontoMensal,
  type VendasDeUmCliente,
} from './vendas-mensais.regras';

/**
 * Vendas mensais da carteira (gráfico do painel do gestor, Etapa 7): busca os
 * clientes ativos, consulta no ERP (via `erp.service`) as vendas dos últimos
 * 12 meses de cada um e entrega às regras puras de `vendas-mensais.regras.ts`.
 * ERP indisponível não derruba a resposta: o cliente afetado fica fora da
 * soma e é contado em `clientesIndisponiveis`.
 */
export type VendasMensaisDTO = {
  /** 12 meses ('AAAA-MM'), do mais antigo ao atual. */
  meses: PontoMensal[];
  /** Eventos sazonais que caem na janela dos 12 meses, por data. */
  eventos: MarcadorDeEvento[];
  simulado: boolean;
  /** Clientes ativos com `erpId` (os que o ERP pode responder). */
  clientesConsultados: number;
  /** Dos consultados, quantos o ERP não conseguiu responder. */
  clientesIndisponiveis: number;
};

/**
 * Com `representanteId`, só a carteira daquele representante; sem ele, a
 * empresa toda. O período no ERP vai de 00:00 do primeiro dia do mês mais
 * antigo ao fim de hoje.
 */
export async function obterVendasMensais(hoje: Date = new Date(), representanteId?: string): Promise<VendasMensaisDTO> {
  const hojeCal = dataCalendario(hoje);
  const meses = mesesDaJanela(hojeCal);

  const ativos = await clientRepository.listAtivosParaAgenda(representanteId);
  const erpIds = ativos.flatMap((cliente) => (cliente.erpId ? [cliente.erpId] : []));

  const { vendasPorErpId, indisponiveis } = await consultarVendasEmLote(erpIds, {
    inicio: inicioDoDia(`${meses[0]}-01`),
    fim: fimDoDia(hojeCal),
  });

  // Liga as vendas de cada erpId ao cliente; quem o ERP não respondeu fica fora.
  const vendasPorCliente: VendasDeUmCliente[] = ativos.flatMap(({ id, nomeFantasia, erpId }) => {
    const vendas = erpId ? vendasPorErpId.get(erpId) : undefined;
    return vendas ? [{ cliente: { id, nomeFantasia }, vendas }] : [];
  });

  return {
    meses: serieMensal(vendasPorCliente, meses),
    eventos: marcadoresDeEventos(hojeCal),
    simulado: erpSimulado(),
    clientesConsultados: erpIds.length,
    clientesIndisponiveis: erpIds.filter((erpId) => indisponiveis.includes(erpId)).length,
  };
}
