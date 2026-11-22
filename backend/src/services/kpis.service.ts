import * as clientRepository from '../repositories/client.repository';
import * as userRepository from '../repositories/user.repository';
import * as visitRepository from '../repositories/visit.repository';
import { classificacaoDoCliente, fimDoDia, inicioDoDia } from './classificacao.service';
import { chaveDoCliente, consultarUltimasVendas, erpSimulado } from './erp.service';
import {
  agruparPorRepresentante,
  clientesNaoVisitados,
  contarInativos,
  contarVisitas,
  conversaoEmVendas,
  detalharVisitas,
  distribuicaoPorCor,
  granularidadeDoRitmo,
  mediaDeVisitasPorCliente,
  ritmoNoPeriodo,
  taxaDeRegistro,
  type ClienteNaoVisitado,
  type DistribuicaoPorCor,
  type Janela,
  type KpiRepresentante,
  type Proporcao,
  type Ritmo,
  type VisitaDetalhada,
} from './kpis.regras';
import { agora } from '../lib/relogio';

/**
 * Indicadores do painel do gestor: busca visitas e clientes
 * ativos (e, via `erp.service`, a última compra para a cor composta), entrega
 * às regras puras de `kpis.regras.ts` e projeta o DTO (mesmo papel de
 * `insights.service.ts` sobre `insights.regras.ts`). Indisponibilidade do ERP
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
  /** Nenhuma visita no período. */
  semDados: boolean;
  /** `erpSimulado()`: a cor composta consulta o ERP. */
  simulado: boolean;
};

export type KpisPorRepresentanteDTO = {
  /** Mesmo objeto de `KpisDTO.periodo`. */
  periodo: KpisDTO['periodo'];
  representantes: KpiRepresentante[];
  /** Visitas e vendas por semana (período de até 91 dias) ou por mês, nas faixas que cruzam o período. */
  ritmo: Ritmo;
  simulado: boolean;
};

export type DetalheDasVisitasDTO = {
  /** Mesmo objeto de `KpisDTO.periodo`. */
  periodo: KpisDTO['periodo'];
  /** A do ritmo de `KpisPorRepresentanteDTO`: a `faixaInicio` de cada visita é o `inicio` de uma faixa dele. */
  granularidade: Ritmo['granularidade'];
  /** Todas as visitas do período, da mais recente para a mais antiga. */
  visitas: VisitaDetalhada[];
  /** Clientes ativos da carteira sem visita no período. */
  naoVisitados: ClienteNaoVisitado[];
  simulado: boolean;
};

/**
 * Com `representanteId`, todos os números se restringem à carteira daquele
 * representante: clientes ativos dele e visitas a esses clientes
 * (a carteira do cliente decide, não o autor). Sem ele, a empresa toda.
 */
export async function obterKpis(
  janela: Janela,
  hoje: Date = agora(),
  representanteId?: string,
): Promise<KpisDTO> {
  const { inicio, fim } = janela;

  const [visitas, ativos] = await Promise.all([
    visitRepository.listNoPeriodo(inicioDoDia(inicio), fimDoDia(fim), representanteId),
    clientRepository.listAtivosParaAgenda(representanteId),
  ]);

  const ultimasVendas = await consultarUltimasVendas(ativos.map(chaveDoCliente));

  const distribuicao = distribuicaoPorCor(
    ativos.map(
      (cliente) =>
        classificacaoDoCliente(cliente.visits, hoje, ultimasVendas.get(chaveDoCliente(cliente) ?? '') ?? null).cor,
    ),
  );

  const total = contarVisitas(visitas);

  return {
    periodo: janela,
    clientesAtivos: ativos.length,
    visitas: { total, mediaPorCliente: mediaDeVisitasPorCliente(total, ativos.length) },
    taxaDeRegistro: taxaDeRegistro(
      visitas,
      ativos.map((cliente) => cliente.id),
    ),
    conversaoEmVendas: conversaoEmVendas(visitas),
    inativos: { total: contarInativos(distribuicao), distribuicao },
    semDados: visitas.length === 0,
    simulado: erpSimulado(),
  };
}

/**
 * Comparativo por representante no período, pela carteira do cliente: sem
 * `representanteId`, todos os usuários REPRESENTANTE (mesmo sem cliente nem
 * visita); com ele, só aquele (lista vazia se o id não for de um
 * representante). Junto, o ritmo de visitas da mesma carteira no período
 * (por semana ou por mês, ver `ritmoNoPeriodo`): uma consulta só, a da
 * janela, alimenta o comparativo e o ritmo.
 */
export async function obterKpisPorRepresentante(
  janela: Janela,
  representanteId?: string,
): Promise<KpisPorRepresentanteDTO> {
  const { inicio, fim } = janela;

  const [visitas, ativos, todosOsRepresentantes] = await Promise.all([
    visitRepository.listNoPeriodoComPedido(inicioDoDia(inicio), fimDoDia(fim), representanteId),
    clientRepository.listAtivosParaAgenda(representanteId),
    // Inclui inativos: inativar a conta não apaga o histórico do comparativo.
    userRepository.listByRole('REPRESENTANTE', { incluirInativos: true }),
  ]);

  const representantes = representanteId
    ? todosOsRepresentantes.filter((representante) => representante.id === representanteId)
    : todosOsRepresentantes;

  return {
    periodo: janela,
    representantes: agruparPorRepresentante(
      visitas,
      ativos.map((cliente) => ({ representanteId: cliente.representante.id })),
      representantes,
    ),
    ritmo: ritmoNoPeriodo(visitas, janela),
    simulado: erpSimulado(),
  };
}

/**
 * Detalhe do painel lateral: as visitas do período (o mesmo recorte e a mesma
 * carteira de `obterKpis` e `obterKpisPorRepresentante`) com cliente,
 * representante, valor e faixa do ritmo, e os clientes ativos sem visita no
 * período. Uma consulta à parte, só quando o painel abre, para os indicadores
 * continuarem leves.
 */
export async function obterDetalheDasVisitas(
  janela: Janela,
  hoje: Date = agora(),
  representanteId?: string,
): Promise<DetalheDasVisitasDTO> {
  const { inicio, fim } = janela;

  const [visitas, ativos] = await Promise.all([
    visitRepository.listNoPeriodoParaDetalhe(inicioDoDia(inicio), fimDoDia(fim), representanteId),
    clientRepository.listAtivosParaAgenda(representanteId),
  ]);

  return {
    periodo: janela,
    granularidade: granularidadeDoRitmo(janela),
    visitas: detalharVisitas(visitas, janela),
    naoVisitados: clientesNaoVisitados(ativos, new Set(visitas.map((visita) => visita.cliente.id)), hoje),
    simulado: erpSimulado(),
  };
}
