/**
 * Limiares da classificação por cor (Etapas 4 e 5), usados pelos textos da
 * interface (legenda e etiqueta de situação). Espelha
 * backend/src/config/classificacao.ts — ao mudar lá, mudar aqui.
 */

/** Visitado há até este número de dias: VERDE (com venda) ou AMARELO (sem venda). */
export const LIMIAR_VERDE_AMARELO_DIAS = 15;

/** Acima de LIMIAR_VERDE_AMARELO_DIAS e até este número de dias sem visita: LARANJA; acima: VERMELHO. */
export const LIMIAR_LARANJA_DIAS = 30;

/** Sem compra no ERP há mais que este número de dias: VERDE/AMARELO caem para LARANJA. */
export const LIMIAR_SEM_COMPRA_DIAS = 60;
