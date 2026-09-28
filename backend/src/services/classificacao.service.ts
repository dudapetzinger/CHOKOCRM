import type { ResultadoVisita } from '@prisma/client';
import {
  FUSO_HORARIO,
  LIMIAR_VERDE_AMARELO_DIAS,
  LIMIAR_LARANJA_DIAS,
  LIMIAR_SEM_COMPRA_DIAS,
} from '../config/classificacao';

const MILISSEGUNDOS_POR_DIA = 86_400_000;

/** Tupla (não union solto): a Task 3 passa `CORES` direto para `z.enum`. */
export const CORES = ['VERDE', 'AMARELO', 'LARANJA', 'VERMELHO'] as const;
export type Cor = (typeof CORES)[number];

/** Data de calendário no formato `YYYY-MM-DD`, já no FUSO_HORARIO. */
export type DataCalendario = string;

export type UltimaVisita = { dataHora: Date; resultado: ResultadoVisita } | null;

const formatadorDataCalendario = new Intl.DateTimeFormat('en-CA', {
  timeZone: FUSO_HORARIO,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Converte um instante (UTC) para a data de calendário no FUSO_HORARIO. */
export function dataCalendario(instante: Date): DataCalendario {
  return formatadorDataCalendario.format(instante);
}

/** Época (ms UTC) do início do dia de uma `DataCalendario`, para aritmética de dias. */
function epocaDoDia(data: DataCalendario): number {
  const [ano, mes, dia] = data.split('-').map(Number);
  return Date.UTC(ano as number, (mes as number) - 1, dia as number);
}

export function somarDias(data: DataCalendario, dias: number): DataCalendario {
  const epoca = epocaDoDia(data) + dias * MILISSEGUNDOS_POR_DIA;
  return new Date(epoca).toISOString().slice(0, 10);
}

/** `ate - de`, em dias de calendário; pode ser negativo. */
export function diasEntre(de: DataCalendario, ate: DataCalendario): number {
  return (epocaDoDia(ate) - epocaDoDia(de)) / MILISSEGUNDOS_POR_DIA;
}

export function diasSemVisita(ultima: UltimaVisita, hoje: Date): number | null {
  if (ultima === null) {
    return null;
  }

  return Math.max(0, diasEntre(dataCalendario(ultima.dataHora), dataCalendario(hoje)));
}

/**
 * Tabela de classificação (spec §4.1):
 * sem visita → VERMELHO; ≤15 dias com VENDA → VERDE; ≤15 dias sem VENDA →
 * AMARELO; 16–30 dias → LARANJA; >30 dias → VERMELHO.
 */
export function classificarCor(ultima: UltimaVisita, hoje: Date): Cor {
  if (ultima === null) {
    return 'VERMELHO';
  }

  const dias = diasSemVisita(ultima, hoje) as number;

  if (dias <= LIMIAR_VERDE_AMARELO_DIAS) {
    return ultima.resultado === 'VENDA' ? 'VERDE' : 'AMARELO';
  }

  if (dias <= LIMIAR_LARANJA_DIAS) {
    return 'LARANJA';
  }

  return 'VERMELHO';
}

/** Dias de calendário desde a última venda no ERP; `null` sem venda registrada. */
export function diasSemCompra(ultimaVenda: Date | null, hoje: Date): number | null {
  if (ultimaVenda === null) {
    return null;
  }

  return Math.max(0, diasEntre(dataCalendario(ultimaVenda), dataCalendario(hoje)));
}

/**
 * Regra de cor composta (spec Etapa 5): se a última venda no ERP está há
 * mais de `LIMIAR_SEM_COMPRA_DIAS` dias, VERDE/AMARELO são rebaixados para
 * LARANJA. LARANJA e VERMELHO não mudam; sem `ultimaVenda`, mantém a base.
 */
export function aplicarRebaixamentoPorVenda(corBase: Cor, ultimaVenda: Date | null, hoje: Date): Cor {
  const dias = diasSemCompra(ultimaVenda, hoje);

  if (dias === null || dias <= LIMIAR_SEM_COMPRA_DIAS) {
    return corBase;
  }

  if (corBase === 'VERDE' || corBase === 'AMARELO') {
    return 'LARANJA';
  }

  return corBase;
}

/**
 * Deriva a última visita (mais recente por `dataHora`) e a cor/dias sem
 * visita a partir dela — ponto único usado pelos dois DTOs de cliente
 * (lista e ficha) para não divergirem sobre como `ultima` é obtida. `cor`
 * já é a composta (rebaixada por `ultimaVenda` quando aplicável).
 */
export function classificacaoDoCliente(
  visits: { dataHora: Date; resultado: ResultadoVisita }[],
  hoje: Date,
  ultimaVenda: Date | null = null,
): {
  ultima: UltimaVisita;
  cor: Cor;
  diasSemVisita: number | null;
  rebaixadoPorVenda: boolean;
  diasSemCompra: number | null;
} {
  const ultima = visits[0] ?? null;
  const corBase = classificarCor(ultima, hoje);
  const cor = aplicarRebaixamentoPorVenda(corBase, ultimaVenda, hoje);

  return {
    ultima,
    cor,
    diasSemVisita: diasSemVisita(ultima, hoje),
    rebaixadoPorVenda: cor !== corBase,
    diasSemCompra: diasSemCompra(ultimaVenda, hoje),
  };
}

/** Soma a recorrência à data da última visita ou, sem visita, à de `criadoEm`. */
export function calcularProximaVisita(
  ultima: UltimaVisita,
  criadoEm: Date,
  recorrenciaDias: number,
): DataCalendario {
  const base = ultima === null ? criadoEm : ultima.dataHora;
  return somarDias(dataCalendario(base), recorrenciaDias);
}

const ORDEM_DAS_CORES: Record<Cor, number> = {
  VERMELHO: 0,
  LARANJA: 1,
  AMARELO: 2,
  VERDE: 3,
};

export function ordemDeCor(cor: Cor): number {
  return ORDEM_DAS_CORES[cor];
}
