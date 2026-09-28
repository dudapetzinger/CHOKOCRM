/**
 * Limiares de classificação por cor e fuso horário usado para calcular
 * "dias sem visita" em dias de calendário (não em janelas de 24h) — o
 * servidor roda em UTC, mas a régua de dias é a do fuso do representante.
 */
export const LIMIAR_VERDE_AMARELO_DIAS = 15;
export const LIMIAR_LARANJA_DIAS = 30;
export const FAIXA_RECORRENCIA_SUGERIDA = { min: 15, max: 30 } as const;
export const FUSO_HORARIO = 'America/Sao_Paulo';
