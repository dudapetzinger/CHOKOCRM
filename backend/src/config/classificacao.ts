/**
 * Limiares de classificação por cor e fuso horário usado para calcular
 * "dias sem visita" em dias de calendário (não em janelas de 24h): o
 * servidor roda em UTC, mas a régua de dias é a do fuso do representante.
 */
export const LIMIAR_VERDE_AMARELO_DIAS = 15;
export const LIMIAR_LARANJA_DIAS = 30;
export const FUSO_HORARIO = 'America/Sao_Paulo';

/**
 * Limiar (em dias) de última venda no ERP a partir do qual a cor composta
 * rebaixa VERDE/AMARELO para LARANJA. Exatamente no
 * limiar (60 dias) ainda não rebaixa, só acima dele.
 */
export const LIMIAR_SEM_COMPRA_DIAS = 60;
