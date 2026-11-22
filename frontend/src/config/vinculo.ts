/**
 * Regra do vínculo entre nota e visita, usada pelos textos da interface.
 * Espelha `DIAS_DA_JANELA_DO_VINCULO` de
 * `backend/src/services/importacao-nf/vinculo.regras.ts`: ao mudar lá, mudar aqui.
 */

/** A nota se liga a uma visita do cliente no dia da nota ou até este número de dias antes. */
export const DIAS_DA_JANELA_DO_VINCULO = 15;
