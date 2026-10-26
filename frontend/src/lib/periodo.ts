/**
 * Período de análise do Painel (Etapa 9): ou uma janela em dias que termina
 * hoje (30, 90 ou 365) ou uma faixa personalizada `inicio`–`fim`
 * ('AAAA-MM-DD', as duas pontas inclusas). É o formato que o filtro, os
 * serviços e os hooks trocam entre si; `queryDoPeriodo` o traduz para o
 * contrato da API (`periodoDias` ou `inicio` e `fim`, nunca os dois) e
 * `chaveDoPeriodo` o põe na chave das consultas. O Painel mostra até
 * `LIMITE_DIAS_DO_PAINEL` dias por vez; a Planilha não tem limite.
 */

export type FaixaPersonalizada = { inicio: string; fim: string };
export type Periodo = { dias: 30 | 90 | 365 } | FaixaPersonalizada;

export const PERIODO_PADRAO: Periodo = { dias: 30 };

export const LIMITE_DIAS_DO_PAINEL = 365;

export const MENSAGEM_LIMITE_DO_PAINEL = 'O Painel mostra até 365 dias por vez. Para um período maior, use a Planilha.';

const MS_POR_DIA = 24 * 60 * 60 * 1000;

export function ehPersonalizado(periodo: Periodo): periodo is FaixaPersonalizada {
  return 'inicio' in periodo;
}

function meiaNoiteUtc(data: string): number {
  const [ano, mes, dia] = data.split('-').map(Number) as [number, number, number];
  return Date.UTC(ano, mes - 1, dia);
}

/** Quantos dias tem a faixa, contando as duas pontas (de 01/10 a 25/10 são 25). */
export function diasDaFaixa(inicio: string, fim: string): number {
  return Math.round((meiaNoiteUtc(fim) - meiaNoiteUtc(inicio)) / MS_POR_DIA) + 1;
}

/** '30' ou '2026-10-01_2026-10-25', para a chave das consultas. */
export function chaveDoPeriodo(periodo: Periodo): string {
  return ehPersonalizado(periodo) ? `${periodo.inicio}_${periodo.fim}` : String(periodo.dias);
}

/** `periodoDias=` ou `inicio=&fim=`: a API recusa os dois juntos. */
export function queryDoPeriodo(periodo: Periodo): URLSearchParams {
  return ehPersonalizado(periodo)
    ? new URLSearchParams({ inicio: periodo.inicio, fim: periodo.fim })
    : new URLSearchParams({ periodoDias: String(periodo.dias) });
}
