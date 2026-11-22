/**
 * Período de análise do Painel: o mês atual (do dia 1º até hoje), uma janela
 * em dias que termina hoje (30, 90 ou 365) ou uma faixa personalizada
 * `inicio` a `fim` ('AAAA-MM-DD', as duas pontas inclusas). É o formato que o
 * filtro, os serviços e os hooks trocam entre si; `queryDoPeriodo` o traduz
 * para o contrato da API (`periodoDias` ou `inicio` e `fim`, nunca os dois) e
 * `chaveDoPeriodo` o põe na chave das consultas. O Painel mostra até
 * `LIMITE_DIAS_DO_PAINEL` dias por vez; a Planilha não tem limite.
 *
 * O Painel abre no mês atual: é o período da meta mensal, e assim os
 * indicadores e a meta contam as mesmas visitas.
 */
import { hojeEmSaoPaulo } from './calendario';

export type FaixaPersonalizada = { inicio: string; fim: string };
export type MesAtual = { mes: 'ATUAL' };
export type Periodo = { dias: 30 | 90 | 365 } | MesAtual | FaixaPersonalizada;

export const PERIODO_PADRAO: Periodo = { mes: 'ATUAL' };

export const LIMITE_DIAS_DO_PAINEL = 365;

export const MENSAGEM_LIMITE_DO_PAINEL = 'O Painel mostra até 365 dias por vez. Para um período maior, use a Planilha.';

const MS_POR_DIA = 24 * 60 * 60 * 1000;

export function ehPersonalizado(periodo: Periodo): periodo is FaixaPersonalizada {
  return 'inicio' in periodo;
}

export function ehMesAtual(periodo: Periodo): periodo is MesAtual {
  return 'mes' in periodo;
}

/** O mês de `hoje` como faixa: do dia 1º até hoje. */
export function faixaDoMesAtual(hoje: string): FaixaPersonalizada {
  return { inicio: `${hoje.slice(0, 7)}-01`, fim: hoje };
}

function meiaNoiteUtc(data: string): number {
  const [ano, mes, dia] = data.split('-').map(Number) as [number, number, number];
  return Date.UTC(ano, mes - 1, dia);
}

/** Quantos dias tem a faixa, contando as duas pontas (de 01/10 a 25/10 são 25). */
export function diasDaFaixa(inicio: string, fim: string): number {
  return Math.round((meiaNoiteUtc(fim) - meiaNoiteUtc(inicio)) / MS_POR_DIA) + 1;
}

/** 'mes-atual', '30' ou '2026-10-01_2026-10-25', para a chave das consultas. */
export function chaveDoPeriodo(periodo: Periodo): string {
  if (ehMesAtual(periodo)) return 'mes-atual';
  return ehPersonalizado(periodo) ? `${periodo.inicio}_${periodo.fim}` : String(periodo.dias);
}

/**
 * `periodoDias=` ou `inicio=&fim=`: a API recusa os dois juntos. O mês atual
 * vai como faixa, do dia 1º até `hoje`.
 */
export function queryDoPeriodo(periodo: Periodo, hoje: string = hojeEmSaoPaulo()): URLSearchParams {
  if (ehMesAtual(periodo)) return new URLSearchParams(faixaDoMesAtual(hoje));
  return ehPersonalizado(periodo)
    ? new URLSearchParams({ inicio: periodo.inicio, fim: periodo.fim })
    : new URLSearchParams({ periodoDias: String(periodo.dias) });
}
