import type { ResultadoVisita } from '@prisma/client';
import { CORES_INATIVAS } from '../config/kpis';
import { CORES, somarDias, type Cor, type DataCalendario } from './classificacao.service';

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

function proporcao(numerador: number, denominador: number): Proporcao {
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
