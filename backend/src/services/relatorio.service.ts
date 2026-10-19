import { Prisma } from '@prisma/client';
import * as clientRepository from '../repositories/client.repository';
import * as visitRepository from '../repositories/visit.repository';
import {
  classificacaoDoCliente,
  dataCalendario,
  fimDoDia,
  inicioDoDia,
  ordemDeCor,
  type Cor,
} from './classificacao.service';
import { consultarUltimasVendas } from './erp.service';
import { periodoDeAnalise } from './kpis.regras';

/**
 * Relatório da planilha do Painel (spec 7.12): uma linha por cliente ativo
 * da carteira, na ordem de urgência da lista de clientes, com a situação
 * (rótulo da cor composta, como a lista mostra), os dias sem visita e as
 * visitas e vendas do período dos indicadores. Vendas = soma dos pedidos
 * (quantidade × preço gravado) das visitas com VENDA, em `Decimal`, como o
 * realizado das metas; sai em reais com 2 casas. Visitas e vendas contam
 * pela carteira do cliente, não pelo autor da visita, como nos indicadores.
 */
export type LinhaDoRelatorioDTO = {
  cliente: string;
  cidade: string;
  representante: string;
  situacao: string;
  /** `null` quando o cliente nunca foi visitado. */
  diasSemVisita: number | null;
  visitasNoPeriodo: number;
  vendasNoPeriodo: number;
};

const ROTULO_DA_COR: Record<Cor, string> = {
  VERDE: 'Verde',
  AMARELO: 'Amarelo',
  LARANJA: 'Laranja',
  VERMELHO: 'Vermelho',
};

type Ordenavel = { cor: Cor; diasSemVisita: number | null; nome: string };

/**
 * A mesma ordem da lista de clientes (`ordenarPorUrgencia` do front):
 * VERMELHO → LARANJA → AMARELO → VERDE; na mesma cor, "nunca visitado"
 * primeiro, depois mais dias sem visita; empate pelo nome.
 */
export function compararPorUrgencia(a: Ordenavel, b: Ordenavel): number {
  const porCor = ordemDeCor(a.cor) - ordemDeCor(b.cor);
  if (porCor !== 0) {
    return porCor;
  }
  const diasA = a.diasSemVisita ?? Number.POSITIVE_INFINITY;
  const diasB = b.diasSemVisita ?? Number.POSITIVE_INFINITY;
  if (diasA !== diasB) {
    return diasA > diasB ? -1 : 1;
  }
  return a.nome.localeCompare(b.nome, 'pt-BR');
}

/** Com `representanteId`, só a carteira daquele representante; sem ele, a empresa toda. */
export async function obterRelatorio(
  periodoDias: number,
  hoje: Date = new Date(),
  representanteId?: string,
): Promise<LinhaDoRelatorioDTO[]> {
  const { inicio, fim } = periodoDeAnalise(dataCalendario(hoje), periodoDias);

  const [ativos, visitas] = await Promise.all([
    clientRepository.listAtivosParaAgenda(representanteId),
    visitRepository.listNoPeriodoComPedido(inicioDoDia(inicio), fimDoDia(fim), representanteId),
  ]);

  const ultimasVendas = await consultarUltimasVendas(ativos.map((cliente) => cliente.erpId));

  const doPeriodo = new Map<string, { visitas: number; vendas: Prisma.Decimal }>();
  for (const visita of visitas) {
    const soma = doPeriodo.get(visita.clientId) ?? { visitas: 0, vendas: new Prisma.Decimal(0) };
    soma.visitas += 1;
    if (visita.resultado === 'VENDA') {
      soma.vendas = visita.itens.reduce(
        (total, item) => total.plus(item.precoUnitario.times(item.quantidade)),
        soma.vendas,
      );
    }
    doPeriodo.set(visita.clientId, soma);
  }

  return ativos
    .map((cliente) => {
      const { cor, diasSemVisita } = classificacaoDoCliente(
        cliente.visits,
        hoje,
        ultimasVendas.get(cliente.erpId ?? '') ?? null,
      );
      return { cliente, cor, diasSemVisita, nome: cliente.nomeFantasia };
    })
    .sort(compararPorUrgencia)
    .map(({ cliente, cor, diasSemVisita }) => {
      const periodo = doPeriodo.get(cliente.id);
      return {
        cliente: cliente.nomeFantasia,
        cidade: cliente.cidade,
        representante: cliente.representante.nome,
        situacao: ROTULO_DA_COR[cor],
        diasSemVisita,
        visitasNoPeriodo: periodo?.visitas ?? 0,
        vendasNoPeriodo: periodo ? periodo.vendas.toDecimalPlaces(2).toNumber() : 0,
      };
    });
}
