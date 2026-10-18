import * as clientRepository from '../repositories/client.repository';
import * as stockMessageRepository from '../repositories/stock-message.repository';
import * as userRepository from '../repositories/user.repository';
import * as visitRepository from '../repositories/visit.repository';
import { classificacaoDoCliente, dataCalendario, fimDoDia, inicioDoDia } from './classificacao.service';
import { consultarUltimasVendas, erpSimulado } from './erp.service';
import {
  agruparPorRepresentante,
  contarInativos,
  contarVisitas,
  conversaoEmVendas,
  distribuicaoPorCor,
  inicioDoRitmoSemanal,
  mediaDeVisitasPorCliente,
  periodoDeAnalise,
  ritmoSemanal,
  taxaDeRegistro,
  type DistribuicaoPorCor,
  type KpiRepresentante,
  type Proporcao,
  type SemanaDoRitmo,
} from './kpis.regras';

/**
 * Indicadores do painel do gestor (UC14): busca visitas, mensagens e clientes
 * ativos (e, via `erp.service`, a última compra para a cor composta), entrega
 * às regras puras de `kpis.regras.ts` e projeta o DTO — mesmo papel de
 * `insights.service.ts` sobre `insights.regras.ts`. Indisponibilidade do ERP
 * chega como `null` em `consultarUltimasVendas` e a cor cai na regra base,
 * como na lista de clientes.
 */
export type KpisDTO = {
  /** `inicio` e `fim` em 'AAAA-MM-DD'. */
  periodo: { dias: number; inicio: string; fim: string };
  clientesAtivos: number;
  visitas: { total: number; mediaPorCliente: number | null };
  taxaDeRegistro: Proporcao;
  conversaoEmVendas: Proporcao;
  inativos: { total: number; distribuicao: DistribuicaoPorCor };
  /** Nenhuma visita nem mensagem no período (UC14 A1). */
  semDados: boolean;
  /** `erpSimulado()` — a cor composta consulta o ERP. */
  simulado: boolean;
};

export type KpisPorRepresentanteDTO = {
  /** Mesmo objeto de `KpisDTO.periodo`. */
  periodo: KpisDTO['periodo'];
  representantes: KpiRepresentante[];
  /** Visitas e vendas das 8 últimas semanas (segunda a domingo), a última contendo hoje; independe do período. */
  ritmoSemanal: SemanaDoRitmo[];
  simulado: boolean;
};

/**
 * Com `representanteId`, todos os números se restringem à carteira daquele
 * representante: clientes ativos dele e visitas/mensagens a esses clientes
 * (a carteira do cliente decide, não o autor). Sem ele, a empresa toda.
 */
export async function obterKpis(
  periodoDias: number,
  hoje: Date = new Date(),
  representanteId?: string,
): Promise<KpisDTO> {
  const { inicio, fim } = periodoDeAnalise(dataCalendario(hoje), periodoDias);

  const [visitas, mensagens, ativos] = await Promise.all([
    visitRepository.listNoPeriodo(inicioDoDia(inicio), fimDoDia(fim), representanteId),
    stockMessageRepository.listNoPeriodo(inicioDoDia(inicio), fimDoDia(fim), representanteId),
    clientRepository.listAtivosParaAgenda(representanteId),
  ]);

  const ultimasVendas = await consultarUltimasVendas(ativos.map((cliente) => cliente.erpId));

  const distribuicao = distribuicaoPorCor(
    ativos.map(
      (cliente) => classificacaoDoCliente(cliente.visits, hoje, ultimasVendas.get(cliente.erpId ?? '') ?? null).cor,
    ),
  );

  const total = contarVisitas(visitas);

  return {
    periodo: { dias: periodoDias, inicio, fim },
    clientesAtivos: ativos.length,
    visitas: { total, mediaPorCliente: mediaDeVisitasPorCliente(total, ativos.length) },
    taxaDeRegistro: taxaDeRegistro(
      visitas,
      mensagens,
      ativos.map((cliente) => cliente.id),
    ),
    conversaoEmVendas: conversaoEmVendas(visitas),
    inativos: { total: contarInativos(distribuicao), distribuicao },
    semDados: visitas.length === 0 && mensagens.length === 0,
    simulado: erpSimulado(),
  };
}

/**
 * Comparativo por representante no período, pela carteira do cliente: sem
 * `representanteId`, todos os usuários REPRESENTANTE (mesmo sem cliente nem
 * visita); com ele, só aquele (lista vazia se o id não for de um
 * representante). Junto, o ritmo semanal de visitas da mesma carteira nas 8
 * últimas semanas, que não depende do período: uma consulta só cobre as
 * duas janelas, e o comparativo usa as visitas a partir do início do período.
 */
export async function obterKpisPorRepresentante(
  periodoDias: number,
  hoje: Date = new Date(),
  representanteId?: string,
): Promise<KpisPorRepresentanteDTO> {
  const hojeCalendario = dataCalendario(hoje);
  const { inicio, fim } = periodoDeAnalise(hojeCalendario, periodoDias);
  const inicioDoRitmo = inicioDoRitmoSemanal(hojeCalendario);
  const desde = inicioDoRitmo < inicio ? inicioDoRitmo : inicio;

  const [visitas, ativos, todosOsRepresentantes] = await Promise.all([
    visitRepository.listNoPeriodo(inicioDoDia(desde), fimDoDia(fim), representanteId),
    clientRepository.listAtivosParaAgenda(representanteId),
    userRepository.listByRole('REPRESENTANTE'),
  ]);

  const inicioDoPeriodo = inicioDoDia(inicio);
  const visitasDoPeriodo = visitas.filter((visita) => visita.dataHora >= inicioDoPeriodo);
  const representantes = representanteId
    ? todosOsRepresentantes.filter((representante) => representante.id === representanteId)
    : todosOsRepresentantes;

  return {
    periodo: { dias: periodoDias, inicio, fim },
    representantes: agruparPorRepresentante(
      visitasDoPeriodo,
      ativos.map((cliente) => ({ representanteId: cliente.representante.id })),
      representantes,
    ),
    ritmoSemanal: ritmoSemanal(visitas, hojeCalendario),
    simulado: erpSimulado(),
  };
}
